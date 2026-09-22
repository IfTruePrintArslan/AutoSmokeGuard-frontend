// Thin http client for the AutoSmokeGuard Django REST API.
//
// - request/apiGet/apiPost/apiPatch/apiPut/apiDelete: JSON fetch wrapper
// - apiUpload: XHR-based upload with progress reporting
// - apiDownload: authenticated blob download that triggers a browser save
// - Single-flight token refresh: concurrent 401s share one refresh call
import { getAccess, getRefresh, writeAuth, clearAuth } from './tokens'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const EXPIRED_TOKEN_CODE = 'token_not_valid'

export class ApiError extends Error {
  constructor({ status = 0, code = null, detail = 'Request failed.', errors = null } = {}) {
    super(detail || 'Request failed.')
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail || 'Request failed.'
    this.errors = errors || null
  }

  // Flattened { field: firstMessage } map, handy for binding directly to form state.
  get fieldErrors() {
    if (!this.errors || typeof this.errors !== 'object') return {}
    const out = {}
    for (const [field, messages] of Object.entries(this.errors)) {
      if (Array.isArray(messages) && messages.length) {
        out[field] = String(messages[0])
      } else if (typeof messages === 'string' && messages) {
        out[field] = messages
      }
    }
    return out
  }
}

async function parseBody(res) {
  if (res.status === 204) return null
  let text
  try {
    text = await res.text()
  } catch {
    return null
  }
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function normalizeErrorBody(data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      detail: data.detail || 'Request failed.',
      code: data.code || null,
      errors: data.errors || null,
    }
  }
  return {
    detail: typeof data === 'string' && data ? data : 'Request failed.',
    code: null,
    errors: null,
  }
}

function dispatchUnauthorized() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('asg:unauthorized'))
  }
}

// Single-flight refresh: N concurrent 401s share exactly one refresh call.
let refreshPromise = null

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getRefresh()
      if (!refresh) {
        throw new ApiError({ status: 401, code: EXPIRED_TOKEN_CODE, detail: 'No refresh token available.' })
      }
      const res = await fetch(`${API_BASE}/api/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      const data = await parseBody(res)
      if (!res.ok) {
        const norm = normalizeErrorBody(data)
        throw new ApiError({ status: res.status, code: norm.code, detail: norm.detail, errors: norm.errors })
      }
      writeAuth({ access: data?.access, refresh: data?.refresh || refresh })
      return data
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function request(path, options = {}) {
  const { method = 'GET', body, auth = true, signal, raw = false, headers: extraHeaders, _retried = false } = options

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = { ...extraHeaders }
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (auth) {
    const access = getAccess()
    if (access) headers['Authorization'] = `Bearer ${access}`
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError({ status: 0, code: 'network_error', detail: 'Network error. Please check your connection.' })
  }

  if (res.status === 401 && auth && !_retried) {
    const data = await parseBody(res)
    const norm = normalizeErrorBody(data)
    if (norm.code === EXPIRED_TOKEN_CODE) {
      try {
        await refreshAccessToken()
      } catch {
        clearAuth()
        dispatchUnauthorized()
        throw new ApiError({ status: 401, code: norm.code, detail: norm.detail, errors: norm.errors })
      }
      return request(path, { ...options, _retried: true })
    }
    throw new ApiError({ status: 401, code: norm.code, detail: norm.detail, errors: norm.errors })
  }

  if (!res.ok) {
    const data = await parseBody(res)
    const norm = normalizeErrorBody(data)
    throw new ApiError({ status: res.status, code: norm.code, detail: norm.detail, errors: norm.errors })
  }

  if (raw) return res
  return parseBody(res)
}

export const apiGet = (path, options = {}) => request(path, { ...options, method: 'GET' })
export const apiPost = (path, body, options = {}) => request(path, { ...options, method: 'POST', body })
export const apiPatch = (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body })
export const apiPut = (path, body, options = {}) => request(path, { ...options, method: 'PUT', body })
export const apiDelete = (path, options = {}) => request(path, { ...options, method: 'DELETE' })

function uploadAbortError() {
  const err = new ApiError({ status: 0, code: 'aborted', detail: 'Upload cancelled.' })
  err.name = 'AbortError'
  return err
}

function networkError() {
  return new ApiError({ status: 0, code: 'network_error', detail: 'Network error. Please check your connection.' })
}

// XHR-based upload — fetch cannot report upload progress.
export function apiUpload(path, file, fields = {}, options = {}) {
  const { onProgress, signal, auth = true } = options

  return new Promise((resolve, reject) => {
    // The returned promise MUST settle exactly once on every path. XHR's
    // load/error/abort events are not reliably mutually exclusive across the
    // retry-after-refresh flow below (and one of them, see `onAbort`, can be
    // guaranteed *not* to fire at all), so both outcomes are funnelled
    // through these latches instead of calling resolve/reject directly. A
    // second call is a no-op rather than a silently-dropped settle.
    let settled = false
    const settleResolve = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const settleReject = (err) => {
      if (settled) return
      settled = true
      reject(err)
    }

    const formData = new FormData()
    formData.append('file', file)
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value)
    }

    function send(retried) {
      const xhr = new XMLHttpRequest()
      try {
        xhr.open('POST', `${API_BASE}${path}`)
      } catch {
        settleReject(networkError())
        return
      }

      if (auth) {
        const access = getAccess()
        if (access) xhr.setRequestHeader('Authorization', `Bearer ${access}`)
      }

      let aborted = false
      function onAbort() {
        aborted = true
        xhr.abort()
        // `xhr.abort()` only fires `abort` when the send flag is set. In the
        // OPENED-but-not-yet-sent state (an AbortSignal that was already
        // aborted when `send()` ran — e.g. the user cancelled while the 401
        // token refresh below was in flight, so the retry starts on a dead
        // signal) the spec's abort algorithm fires *nothing at all*, and in
        // the DONE state it is a no-op. Either way `xhr.onabort` never runs,
        // so reject here too; when `abort` does fire, the latch above makes
        // this a harmless duplicate.
        settleReject(uploadAbortError())
      }
      if (signal) {
        if (signal.aborted) {
          onAbort()
          return
        }
        signal.addEventListener('abort', onAbort)
      }

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = async () => {
        if (signal) signal.removeEventListener('abort', onAbort)

        let data
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null
        } catch {
          data = xhr.responseText || null
        }

        if (xhr.status === 401 && auth && !retried) {
          const norm = normalizeErrorBody(data)
          if (norm.code === EXPIRED_TOKEN_CODE) {
            try {
              await refreshAccessToken()
            } catch {
              clearAuth()
              dispatchUnauthorized()
              settleReject(new ApiError({ status: 401, code: norm.code, detail: norm.detail, errors: norm.errors }))
              return
            }
            // No abort listener is registered during the refresh above, so an
            // abort that lands inside that window is only observable here —
            // `send(true)` re-checks `signal.aborted` and rejects.
            send(true)
            return
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          settleResolve(data)
        } else {
          const norm = normalizeErrorBody(data)
          settleReject(new ApiError({ status: xhr.status, code: norm.code, detail: norm.detail, errors: norm.errors }))
        }
      }

      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', onAbort)
        settleReject(networkError())
      }

      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', onAbort)
        settleReject(uploadAbortError())
      }

      try {
        xhr.send(formData)
      } catch {
        if (signal) signal.removeEventListener('abort', onAbort)
        settleReject(networkError())
        return
      }
      if (aborted) xhr.abort()
    }

    send(false)
  })
}

// How long a download's object URL is kept alive after the synthetic click.
// Firefox only *queues* the download on click and reads the `blob:` URL on a
// later task; 40s is the value FileSaver.js settled on after the same bug.
export const DOWNLOAD_REVOKE_DELAY_MS = 40000

// Authenticated blob download that triggers a browser save dialog.
export async function apiDownload(path, filename) {
  const res = await request(path, { raw: true })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)

  try {
    a.click()
  } finally {
    // The revoke MUST NOT be synchronous with the click.
    //
    // Chrome resolves a same-origin `blob:` URL during the click's own
    // dispatch, so revoking straight afterwards happens to survive there.
    // Firefox (and Safari) instead queue the download and only fetch the URL
    // on a later task — by which point a synchronous revoke has already
    // destroyed the blob, so the download silently does nothing. There is no
    // event and no rejection for that failure, so it cannot be caught or
    // retried; the only fix is to keep the URL alive past the click.
    //
    // The anchor is likewise detached a task later rather than inline, and
    // guarded with `isConnected` so a caller that has already cleared the
    // body (a route teardown, a test) cannot throw here.
    setTimeout(() => {
      if (a.isConnected) a.remove()
    }, 0)
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, DOWNLOAD_REVOKE_DELAY_MS)
  }
}

export function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}
