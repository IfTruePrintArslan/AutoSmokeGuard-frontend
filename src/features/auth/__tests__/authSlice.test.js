import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  login,
  register,
  logout,
  fetchMe,
  bootstrap,
  requestPasswordReset,
  confirmPasswordReset,
  authCleared,
} from '../authSlice'
import * as api from '../../../lib/api'
import { readAuth } from '../../../lib/tokens'

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
  }
})

function createTestStore(preloadedAuth) {
  return configureStore({
    reducer: { auth: reducer },
    ...(preloadedAuth ? { preloadedState: { auth: preloadedAuth } } : {}),
  })
}

describe('authSlice reducer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('has the expected initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state).toEqual({
      user: null,
      access: null,
      refresh: null,
      status: 'idle',
      error: null,
      fieldErrors: {},
      bootstrapped: false,
    })
  })

  it('authCleared resets session fields but leaves bootstrapped untouched', () => {
    const seeded = {
      user: { email: 'a@b.com' },
      access: 'a',
      refresh: 'r',
      status: 'fulfilled',
      error: 'x',
      fieldErrors: { email: 'bad' },
      bootstrapped: true,
    }
    const state = reducer(seeded, authCleared())
    expect(state.user).toBeNull()
    expect(state.access).toBeNull()
    expect(state.refresh).toBeNull()
    expect(state.status).toBe('idle')
    expect(state.error).toBeNull()
    expect(state.fieldErrors).toEqual({})
    expect(state.bootstrapped).toBe(true)
  })
})

describe('authSlice thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('login: fulfilled stores the user and tokens (state + storage)', async () => {
    api.apiPost.mockResolvedValueOnce({
      user: { user_id: 1, email: 'a@b.com', full_name: 'A B', role: 'user' },
      access: 'access-1',
      refresh: 'refresh-1',
    })
    const store = createTestStore()

    await store.dispatch(login({ email: 'a@b.com', password: 'secret1' }))

    const state = store.getState().auth
    expect(state.status).toBe('fulfilled')
    expect(state.user.email).toBe('a@b.com')
    expect(state.access).toBe('access-1')
    expect(state.refresh).toBe('refresh-1')
    expect(readAuth()).toMatchObject({ access: 'access-1', refresh: 'refresh-1' })
  })

  it('login: rejected surfaces detail/code/fieldErrors from ApiError', async () => {
    const err = new api.ApiError({
      status: 401,
      code: 'invalid_credentials',
      detail: 'Invalid credentials.',
      errors: { password: ['Incorrect password.'] },
    })
    api.apiPost.mockRejectedValueOnce(err)
    const store = createTestStore()

    const result = await store.dispatch(login({ email: 'a@b.com', password: 'wrong' }))

    expect(login.rejected.match(result)).toBe(true)
    const state = store.getState().auth
    expect(state.status).toBe('rejected')
    expect(state.error).toBe('Invalid credentials.')
    expect(state.fieldErrors).toEqual({ password: 'Incorrect password.' })
  })

  it('register: fulfilled stores the full_name-shaped user', async () => {
    api.apiPost.mockResolvedValueOnce({
      user: { user_id: 2, email: 'new@b.com', full_name: 'New User', role: 'user' },
      access: 'access-2',
      refresh: 'refresh-2',
    })
    const store = createTestStore()

    await store.dispatch(register({ full_name: 'New User', email: 'new@b.com', password: 'secret12' }))

    expect(store.getState().auth.user.full_name).toBe('New User')
  })

  it('register: rejected surfaces field errors', async () => {
    const err = new api.ApiError({
      status: 400,
      code: 'validation_error',
      detail: 'Validation failed.',
      errors: { email: ['Email already exists.'] },
    })
    api.apiPost.mockRejectedValueOnce(err)
    const store = createTestStore()

    const result = await store.dispatch(register({ full_name: 'A', email: 'a@b.com', password: 'secret12' }))

    expect(register.rejected.match(result)).toBe(true)
    expect(store.getState().auth.fieldErrors).toEqual({ email: 'Email already exists.' })
  })

  it('logout: clears state and storage even when the API call fails', async () => {
    api.apiPost.mockRejectedValueOnce(new Error('network down'))
    const store = createTestStore({
      user: { email: 'a@b.com' },
      access: 'a',
      refresh: 'r',
      status: 'fulfilled',
      error: null,
      fieldErrors: {},
      bootstrapped: true,
    })

    await store.dispatch(logout())

    const state = store.getState().auth
    expect(state.user).toBeNull()
    expect(state.access).toBeNull()
    expect(state.refresh).toBeNull()
    expect(readAuth()).toBeNull()
  })

  it('fetchMe: fulfilled updates the user', async () => {
    api.apiGet.mockResolvedValueOnce({ user_id: 1, email: 'a@b.com', full_name: 'A', role: 'user' })
    const store = createTestStore()

    await store.dispatch(fetchMe())

    expect(store.getState().auth.user.email).toBe('a@b.com')
  })

  it('bootstrap: with no stored token, skips fetchMe but still ends bootstrapped', async () => {
    const store = createTestStore()

    await store.dispatch(bootstrap())

    expect(store.getState().auth.bootstrapped).toBe(true)
    expect(api.apiGet).not.toHaveBeenCalled()
  })

  it('bootstrap: clears auth when the stored token fails verification', async () => {
    localStorage.setItem('asg_auth', JSON.stringify({ access: 'stale', refresh: 'r', user: { email: 'a@b.com' } }))
    api.apiGet.mockRejectedValueOnce(
      new api.ApiError({ status: 401, code: 'token_not_valid', detail: 'Token expired.' })
    )
    const store = createTestStore()

    await store.dispatch(bootstrap())

    const state = store.getState().auth
    expect(state.bootstrapped).toBe(true)
    expect(state.user).toBeNull()
    expect(readAuth()).toBeNull()
  })

  it('requestPasswordReset: fulfilled', async () => {
    api.apiPost.mockResolvedValueOnce({ detail: 'Email sent.' })
    const store = createTestStore()

    const result = await store.dispatch(requestPasswordReset({ email: 'a@b.com' }))

    expect(requestPasswordReset.fulfilled.match(result)).toBe(true)
    expect(store.getState().auth.status).toBe('fulfilled')
  })

  it('confirmPasswordReset: rejected surfaces field errors', async () => {
    const err = new api.ApiError({
      status: 400,
      code: 'invalid_token',
      detail: 'Invalid token.',
      errors: { token: ['This token is invalid or has expired.'] },
    })
    api.apiPost.mockRejectedValueOnce(err)
    const store = createTestStore()

    const result = await store.dispatch(confirmPasswordReset({ token: 'bad', password: 'newpass1' }))

    expect(confirmPasswordReset.rejected.match(result)).toBe(true)
    expect(store.getState().auth.fieldErrors).toEqual({ token: 'This token is invalid or has expired.' })
  })
})
