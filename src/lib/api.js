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

// XHR-based upload — fetch cannot report upload progress.
export function apiUpload(path, file, fields = {}, options = {}) {
  const { onProgress, signal, auth = true } = options

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value)
    }

    function send(retried) {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}${path}`)

      if (auth) {
        const access = getAccess()
        if (access) xhr.setRequestHeader('Authorization', `Bearer ${access}`)
      }

      let aborted = false
      function onAbort() {
        aborted = true
        xhr.abort()
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
              send(true)
              return
            } catch {
              clearAuth()
              dispatchUnauthorized()
              reject(new ApiError({ status: 401, code: norm.code, detail: norm.detail, errors: norm.errors }))
              return
            }
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data)
        } else {
          const norm = normalizeErrorBody(data)
          reject(new ApiError({ status: xhr.status, code: norm.code, detail: norm.detail, errors: norm.errors }))
        }
      }

      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', onAbort)
        reject(new ApiError({ status: 0, code: 'network_error', detail: 'Network error. Please check your connection.' }))
      }

      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', onAbort)
        const err = new ApiError({ status: 0, code: 'aborted', detail: 'Upload cancelled.' })
        err.name = 'AbortError'
        reject(err)
      }

      xhr.send(formData)
      if (aborted) xhr.abort()
    }

    send(false)
  })
}

// Authenticated blob download that triggers a browser save dialog.
export async function apiDownload(path, filename) {
  const res = await request(path, { raw: true })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'download'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}
