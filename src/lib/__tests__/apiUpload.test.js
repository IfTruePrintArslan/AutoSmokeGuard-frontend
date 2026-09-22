import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiUpload } from '../api'
import { writeAuth } from '../tokens'

// D29 — apiUpload must settle exactly once on every path.
//
// The dangerous one: `xhr.abort()` on a request that is OPENED but whose send
// flag is not set fires NO events at all (XHR spec, the abort() method / the
// "request error" steps are only reached with the send flag set). The old
// code's `if (signal.aborted) { onAbort(); return }` therefore returned
// without resolving or rejecting, leaving the promise — and the uploadFile
// thunk awaiting it — hung forever.

const XHR_OPENED = 1
const XHR_DONE = 4

class MockXHR {
  static instances = []

  constructor() {
    this.readyState = 0
    this.status = 0
    this.responseText = ''
    this.headers = {}
    this.sendFlag = false
    this.aborted = false
    this.upload = {}
    MockXHR.instances.push(this)
  }

  open(method, url) {
    this.method = method
    this.url = url
    this.readyState = XHR_OPENED
  }

  setRequestHeader(key, value) {
    this.headers[key] = value
  }

  send(body) {
    this.body = body
    this.sendFlag = true
  }

  abort() {
    this.aborted = true
    // Faithful to the spec: events only fire when the send flag is set and
    // the request has not already completed.
    if (this.sendFlag && this.readyState !== XHR_DONE) {
      this.readyState = XHR_DONE
      this.sendFlag = false
      this.onabort?.()
    }
  }

  // ── test helpers ──
  respond(status, body) {
    this.status = status
    this.responseText = body === undefined ? '' : JSON.stringify(body)
    this.readyState = XHR_DONE
    this.sendFlag = false
    this.onload?.()
  }

  fail() {
    this.readyState = XHR_DONE
    this.sendFlag = false
    this.onerror?.()
  }
}

// Resolves to the promise's outcome, or `{ state: 'pending' }` if it has not
// settled in time — so a never-settling promise fails loudly and fast rather
// than hanging until the suite-level timeout.
function settleWithin(promise, ms = 250) {
  return Promise.race([
    promise.then(
      (value) => ({ state: 'fulfilled', value }),
      (reason) => ({ state: 'rejected', reason })
    ),
    new Promise((resolve) => setTimeout(() => resolve({ state: 'pending' }), ms)),
  ])
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const file = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' })

describe('apiUpload settles exactly once', () => {
  let OriginalXHR

  beforeEach(() => {
    localStorage.clear()
    MockXHR.instances = []
    OriginalXHR = globalThis.XMLHttpRequest
    globalThis.XMLHttpRequest = MockXHR
  })

  afterEach(() => {
    globalThis.XMLHttpRequest = OriginalXHR
    vi.restoreAllMocks()
  })

  it('rejects with an AbortError when handed an already-aborted signal (no XHR event ever fires)', async () => {
    const controller = new AbortController()
    controller.abort()

    const outcome = await settleWithin(apiUpload('/api/upload', file, {}, { signal: controller.signal }))

    expect(outcome.state).toBe('rejected')
    expect(outcome.reason.name).toBe('AbortError')
    expect(outcome.reason.code).toBe('aborted')
    // Proof the hang was real: the mock never fired onabort, because the
    // send flag was never set.
    expect(MockXHR.instances).toHaveLength(1)
    expect(MockXHR.instances[0].sendFlag).toBe(false)
  })

  it('rejects when the upload is cancelled while the post-401 token refresh is in flight', async () => {
    // The exact D29 scenario: token expires mid-upload -> 401 ->
    // refreshAccessToken() -> user hits Cancel during the refresh -> the
    // retry send() starts on an already-aborted signal.
    writeAuth({ access: 'expired', refresh: 'still-good', user: { email: 'a@b.com' } })

    const refresh = deferred()
    globalThis.fetch = vi.fn(() => refresh.promise)

    const controller = new AbortController()
    const promise = apiUpload('/api/upload', file, {}, { signal: controller.signal })

    // First attempt comes back 401 with the expired-token code; apiUpload
    // detaches its abort listener and awaits the refresh.
    MockXHR.instances[0].respond(401, { detail: 'Token expired.', code: 'token_not_valid' })
    await Promise.resolve()

    // User cancels mid-refresh. No listener is attached right now, so this
    // fires nothing at all.
    controller.abort()

    refresh.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access: 'fresh', refresh: 'still-good' }),
    })

    const outcome = await settleWithin(promise)

    expect(outcome.state).toBe('rejected')
    expect(outcome.reason.name).toBe('AbortError')
    // The retry opened a second XHR but never sent it.
    expect(MockXHR.instances).toHaveLength(2)
    expect(MockXHR.instances[1].sendFlag).toBe(false)
  })

  it('still rejects exactly once when the abort event does fire mid-flight', async () => {
    const controller = new AbortController()
    const onRejected = vi.fn()
    const promise = apiUpload('/api/upload', file, {}, { signal: controller.signal }).catch(onRejected)

    controller.abort()
    await promise

    expect(onRejected).toHaveBeenCalledTimes(1)
    expect(onRejected.mock.calls[0][0].name).toBe('AbortError')
    expect(MockXHR.instances[0].aborted).toBe(true)
  })

  it('resolves with the parsed body on success and reports progress', async () => {
    const onProgress = vi.fn()
    const promise = apiUpload('/api/upload', file, { note: 'x' }, { onProgress, auth: false })

    MockXHR.instances[0].upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 })
    MockXHR.instances[0].respond(201, { media_id: 'm1' })

    const outcome = await settleWithin(promise)

    expect(outcome.state).toBe('fulfilled')
    expect(outcome.value).toEqual({ media_id: 'm1' })
    expect(onProgress).toHaveBeenCalledWith(25)
  })

  it('rejects with the server envelope on a validation failure', async () => {
    const promise = apiUpload('/api/upload', file, {}, { auth: false })
    MockXHR.instances[0].respond(400, { detail: 'File is empty.', code: 'empty_file' })

    const outcome = await settleWithin(promise)

    expect(outcome.state).toBe('rejected')
    expect(outcome.reason.status).toBe(400)
    expect(outcome.reason.code).toBe('empty_file')
  })

  it('rejects with a network error when the transport fails', async () => {
    const promise = apiUpload('/api/upload', file, {}, { auth: false })
    MockXHR.instances[0].fail()

    const outcome = await settleWithin(promise)

    expect(outcome.state).toBe('rejected')
    expect(outcome.reason.code).toBe('network_error')
  })
})
