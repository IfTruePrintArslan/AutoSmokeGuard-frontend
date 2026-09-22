import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiDownload, DOWNLOAD_REVOKE_DELAY_MS } from '../api'

// D28 — every download in the product goes through apiDownload. Revoking the
// object URL synchronously after the synthetic click works in Chrome (which
// resolves a same-origin blob: URL during the click dispatch) and silently
// breaks in Firefox/Safari, which queue the download and only read the URL on
// a later task. There is no event for that failure, so the only thing a test
// can assert is the timing: the revoke must not have happened by the time the
// click returns, nor by the time apiDownload settles.

function okBlobResponse() {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
  }
}

describe('apiDownload object-URL lifetime', () => {
  let revokeObjectURL
  let clickSpy
  let revokesSeenByClick
  let clickedAnchor

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    // Anchors detach one macrotask after the click, so a test that does not
    // advance its timers leaves one behind for the next test to trip over.
    document.body.innerHTML = ''
    revokesSeenByClick = null
    clickedAnchor = null

    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-download-url')
    revokeObjectURL = vi.fn()
    globalThis.URL.revokeObjectURL = revokeObjectURL

    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordClick() {
      // jsdom cannot navigate; record the anchor and how many revokes had
      // already fired at the exact moment the browser would begin queueing
      // the download.
      clickedAnchor = this
      revokesSeenByClick = revokeObjectURL.mock.calls.length
    })

    globalThis.fetch = vi.fn().mockResolvedValue(okBlobResponse())
  })

  afterEach(() => {
    vi.useRealTimers()
    clickSpy.mockRestore()
  })

  it('does not revoke the object URL synchronously with the click', async () => {
    await apiDownload('/api/report/r1/download', 'report.pdf')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    // The click itself must see a live URL...
    expect(revokesSeenByClick).toBe(0)
    // ...and it must still be live after apiDownload has settled, because
    // Firefox reads it on a *later* task than the one that clicked.
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes the object URL only once the download has had time to start', async () => {
    await apiDownload('/api/report/r1/download', 'report.pdf')

    // Still alive one macrotask later (when the anchor is detached).
    await vi.advanceTimersByTimeAsync(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(DOWNLOAD_REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-download-url')
  })

  it('names the file and detaches the anchor from the document afterwards', async () => {
    await apiDownload('/api/report/r1/download', 'evidence.pdf')

    expect(clickedAnchor).not.toBeNull()
    expect(clickedAnchor.getAttribute('download')).toBe('evidence.pdf')
    expect(clickedAnchor.getAttribute('href')).toBe('blob:mock-download-url')
    expect(clickedAnchor.isConnected).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    expect(clickedAnchor.isConnected).toBe(false)
    expect(document.querySelector('a[download]')).toBeNull()

    // The deferred revoke must survive the node already being gone.
    await vi.advanceTimersByTimeAsync(DOWNLOAD_REVOKE_DELAY_MS)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('falls back to a generic filename when none is given', async () => {
    await apiDownload('/api/report/r1/download')

    expect(clickedAnchor.getAttribute('download')).toBe('download')
    await vi.advanceTimersByTimeAsync(DOWNLOAD_REVOKE_DELAY_MS)
  })
})
