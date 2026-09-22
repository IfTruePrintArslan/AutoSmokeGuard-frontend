// Single owner of auth persistence in localStorage.
// Shape: { access, refresh, user }

const LS_KEY = 'asg_auth'

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

export function readAuth() {
  if (!hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
    return null
  } catch {
    return null
  }
}

export function writeAuth(partial) {
  if (!hasStorage()) return null
  const current = readAuth() || {}
  const next = { ...current, ...partial }
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable (quota exceeded, private mode, etc.) — ignore
  }
  return next
}

export function clearAuth() {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
}

export function getAccess() {
  const auth = readAuth()
  return auth?.access || null
}

export function getRefresh() {
  const auth = readAuth()
  return auth?.refresh || null
}
