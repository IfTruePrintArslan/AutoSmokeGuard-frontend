import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiGet, apiPost, ApiError } from '../api'
import { writeAuth, readAuth } from '../tokens'

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('resolves with parsed JSON on a successful request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))

    const data = await apiGet('/api/me', { auth: false })

    expect(data).toEqual({ ok: true })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('turns an error envelope into an ApiError with status/code/fieldErrors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        detail: 'Validation failed.',
        code: 'validation_error',
        errors: { email: ['Email already exists.'] },
      })
    )

    let caught = null
    try {
      await apiPost('/api/register', { email: 'a@b.com' }, { auth: false })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect(caught.status).toBe(400)
    expect(caught.code).toBe('validation_error')
    expect(caught.detail).toBe('Validation failed.')
    expect(caught.fieldErrors).toEqual({ email: 'Email already exists.' })
  })

  it('refreshes the access token exactly once on a 401 and retries the original request', async () => {
    writeAuth({ access: 'expired-access', refresh: 'valid-refresh', user: { email: 'a@b.com' } })

    const calls = []
    globalThis.fetch = vi.fn((url) => {
      const u = String(url)
      calls.push(u)
      if (u.includes('/api/refresh-token')) {
        return Promise.resolve(jsonResponse(200, { access: 'new-access', refresh: 'new-refresh' }))
      }
      if (u.includes('/api/me')) {
        const meCallsSoFar = calls.filter((c) => c.includes('/api/me')).length
        if (meCallsSoFar === 1) {
          return Promise.resolve(jsonResponse(401, { detail: 'Token expired.', code: 'token_not_valid' }))
        }
        return Promise.resolve(jsonResponse(200, { email: 'a@b.com' }))
      }
      return Promise.resolve(jsonResponse(404, {}))
    })

    const data = await apiGet('/api/me')

    expect(data).toEqual({ email: 'a@b.com' })
    expect(calls.filter((u) => u.includes('/api/refresh-token'))).toHaveLength(1)
    expect(calls.filter((u) => u.includes('/api/me'))).toHaveLength(2)
    expect(readAuth().access).toBe('new-access')
  })

  it('clears storage and fires asg:unauthorized when the refresh call itself fails', async () => {
    writeAuth({ access: 'expired-access', refresh: 'bad-refresh', user: { email: 'a@b.com' } })

    globalThis.fetch = vi.fn((url) => {
      const u = String(url)
      if (u.includes('/api/refresh-token')) {
        return Promise.resolve(jsonResponse(401, { detail: 'Invalid refresh token.', code: 'token_not_valid' }))
      }
      return Promise.resolve(jsonResponse(401, { detail: 'Token expired.', code: 'token_not_valid' }))
    })

    const handler = vi.fn()
    window.addEventListener('asg:unauthorized', handler)

    let caught = null
    try {
      await apiGet('/api/me')
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(readAuth()).toBeNull()

    window.removeEventListener('asg:unauthorized', handler)
  })

  it('shares a single refresh call across two concurrent 401s', async () => {
    writeAuth({ access: 'expired-access', refresh: 'valid-refresh', user: { email: 'a@b.com' } })

    const hitCounts = {}
    globalThis.fetch = vi.fn((url) => {
      const u = String(url)
      if (u.includes('/api/refresh-token')) {
        hitCounts.refresh = (hitCounts.refresh || 0) + 1
        return Promise.resolve(jsonResponse(200, { access: 'new-access', refresh: 'new-refresh' }))
      }
      const key = u.includes('/api/one') ? 'one' : 'two'
      hitCounts[key] = (hitCounts[key] || 0) + 1
      if (hitCounts[key] === 1) {
        return Promise.resolve(jsonResponse(401, { detail: 'Token expired.', code: 'token_not_valid' }))
      }
      return Promise.resolve(jsonResponse(200, { ok: key }))
    })

    const [a, b] = await Promise.all([apiGet('/api/one'), apiGet('/api/two')])

    expect(a).toEqual({ ok: 'one' })
    expect(b).toEqual({ ok: 'two' })
    expect(hitCounts.refresh).toBe(1)
  })
})
