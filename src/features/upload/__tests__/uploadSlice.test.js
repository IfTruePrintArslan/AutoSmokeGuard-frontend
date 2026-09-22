import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { addFiles, uploadFile, cancelUpload } from '../uploadSlice'
import { writeAuth } from '../../../lib/tokens'

// D29, end to end through the queue: when apiUpload's promise never settled,
// the uploadFile thunk never settled either, so its
// `finally { controllers.delete(clientId) }` never ran and the queue row was
// stuck at `uploading` with a frozen progress bar for the rest of the
// session. These tests drive the real api client over a spec-faithful XHR
// stub rather than mocking apiUpload, because the bug lives in the settle
// paths, not in the slice.

const XHR_OPENED = 1
const XHR_DONE = 4

class MockXHR {
  static instances = []

  constructor() {
    this.readyState = 0
    this.status = 0
    this.responseText = ''
    this.sendFlag = false
    this.upload = {}
    MockXHR.instances.push(this)
  }

  open(method, url) {
    this.method = method
    this.url = url
    this.readyState = XHR_OPENED
  }

  setRequestHeader() {}

  send(body) {
    this.body = body
    this.sendFlag = true
  }

  abort() {
    // Aborting in the OPENED state with the send flag unset fires nothing.
    if (this.sendFlag && this.readyState !== XHR_DONE) {
      this.readyState = XHR_DONE
      this.sendFlag = false
      this.onabort?.()
    }
  }

  respond(status, body) {
    this.status = status
    this.responseText = body === undefined ? '' : JSON.stringify(body)
    this.readyState = XHR_DONE
    this.sendFlag = false
    this.onload?.()
  }
}

function settleWithin(promise, ms = 250) {
  return Promise.race([
    promise.then(
      (value) => ({ state: 'settled', value }),
      (reason) => ({ state: 'threw', reason })
    ),
    new Promise((resolve) => setTimeout(() => resolve({ state: 'pending' }), ms)),
  ])
}

function deferred() {
  let resolve
  const promise = new Promise((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const CLIENT_ID = 'client-1'

function createTestStore() {
  const store = configureStore({ reducer: { upload: reducer } })
  store.dispatch(
    addFiles([
      {
        id: CLIENT_ID,
        name: 'clip.mp4',
        size: 10,
        type: 'video/mp4',
        previewUrl: null,
        progress: 0,
        status: 'queued',
        sub: 'Queued',
        error: null,
        media_id: null,
      },
    ])
  )
  return store
}

const file = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' })

describe('uploadFile queue row always reaches a final state (D29)', () => {
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

  it('marks the row cancelled when the user cancels during a mid-upload token refresh', async () => {
    writeAuth({ access: 'expired', refresh: 'still-good', user: { email: 'a@b.com' } })
    const refresh = deferred()
    globalThis.fetch = vi.fn(() => refresh.promise)

    const store = createTestStore()
    const dispatched = store.dispatch(uploadFile({ file, clientId: CLIENT_ID }))

    expect(store.getState().upload.items[0].status).toBe('uploading')

    // Access token expired mid-upload.
    MockXHR.instances[0].respond(401, { detail: 'Token expired.', code: 'token_not_valid' })
    await Promise.resolve()

    // User hits Cancel while the refresh is in flight.
    cancelUpload(CLIENT_ID)
    refresh.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access: 'fresh', refresh: 'still-good' }),
    })

    const outcome = await settleWithin(dispatched)

    // The thunk MUST settle — otherwise the row below never leaves
    // 'uploading' and its AbortController is never released.
    expect(outcome.state).toBe('settled')
    const item = store.getState().upload.items[0]
    expect(item.status).toBe('rejected')
    expect(item.error).toBe('Upload cancelled.')
  })

  it('releases the abort controller so a second Cancel is a no-op rather than a throw', async () => {
    writeAuth({ access: 'expired', refresh: 'still-good', user: { email: 'a@b.com' } })
    const refresh = deferred()
    globalThis.fetch = vi.fn(() => refresh.promise)

    const store = createTestStore()
    const dispatched = store.dispatch(uploadFile({ file, clientId: CLIENT_ID }))

    MockXHR.instances[0].respond(401, { detail: 'Token expired.', code: 'token_not_valid' })
    await Promise.resolve()
    cancelUpload(CLIENT_ID)
    refresh.resolve({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access: 'fresh', refresh: 'still-good' }),
    })

    await settleWithin(dispatched)

    // The thunk's `finally` only runs if the promise settled; if the map
    // still held the controller this would be a live abort on a dead xhr.
    expect(() => cancelUpload(CLIENT_ID)).not.toThrow()
  })

  it('marks the row cancelled for an ordinary mid-flight cancel', async () => {
    const store = createTestStore()
    const dispatched = store.dispatch(uploadFile({ file, clientId: CLIENT_ID }))

    cancelUpload(CLIENT_ID)
    const outcome = await settleWithin(dispatched)

    expect(outcome.state).toBe('settled')
    expect(store.getState().upload.items[0].status).toBe('rejected')
    expect(store.getState().upload.items[0].error).toBe('Upload cancelled.')
  })

  it('marks the row uploaded on success', async () => {
    const store = createTestStore()
    const dispatched = store.dispatch(uploadFile({ file, clientId: CLIENT_ID }))

    MockXHR.instances[0].upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 })
    expect(store.getState().upload.items[0].progress).toBe(50)

    MockXHR.instances[0].respond(201, { media_id: 'm1' })
    const outcome = await settleWithin(dispatched)

    expect(outcome.state).toBe('settled')
    const item = store.getState().upload.items[0]
    expect(item.status).toBe('uploaded')
    expect(item.progress).toBe(100)
    expect(item.media_id).toBe('m1')
  })

  it('surfaces a friendly message for a server validation failure', async () => {
    const store = createTestStore()
    const dispatched = store.dispatch(uploadFile({ file, clientId: CLIENT_ID }))

    MockXHR.instances[0].respond(400, { detail: 'Bad.', code: 'file_too_large' })
    await settleWithin(dispatched)

    expect(store.getState().upload.items[0].error).toBe('File exceeds the maximum upload size.')
  })
})
