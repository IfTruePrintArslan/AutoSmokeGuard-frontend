import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGet, apiPost, ApiError } from '../../lib/api'
import { readAuth, writeAuth, clearAuth } from '../../lib/tokens'

const hydrated = readAuth() || {}

const initialState = {
  user: hydrated.user || null,
  access: hydrated.access || null,
  refresh: hydrated.refresh || null,
  status: 'idle', // 'idle' | 'pending' | 'fulfilled' | 'rejected'
  error: null,
  fieldErrors: {},
  bootstrapped: false,
}

function extractRejection(err) {
  if (err instanceof ApiError) {
    return { detail: err.detail, code: err.code, status: err.status, errors: err.fieldErrors }
  }
  return { detail: err?.message || 'Something went wrong.', code: null, status: null, errors: {} }
}

export const register = createAsyncThunk(
  'auth/register',
  async ({ full_name, email, password }, { rejectWithValue }) => {
    try {
      const data = await apiPost('/api/register', { full_name, email, password }, { auth: false })
      writeAuth({ user: data.user, access: data.access, refresh: data.refresh })
      return data
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await apiPost('/api/login', { email, password }, { auth: false })
      writeAuth({ user: data.user, access: data.access, refresh: data.refresh })
      return data
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

// Always clears local auth state, even when the network call fails —
// there is no scenario where staying "logged in" locally is correct.
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const refresh = getState().auth.refresh
    try {
      if (refresh) {
        await apiPost('/api/logout', { refresh })
      }
    } catch {
      // ignore — we clear local state regardless of server outcome
    } finally {
      clearAuth()
    }
    return true
  }
)

export const fetchMe = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiGet('/api/me')
      writeAuth({ user: data })
      return data
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

// Runs once at app start: if a token is already in storage, verify it by
// fetching the current user. Always ends with bootstrapped: true so
// ProtectedRoute knows it is safe to make a redirect decision.
export const bootstrap = createAsyncThunk(
  'auth/bootstrap',
  async (_, { dispatch }) => {
    const stored = readAuth()
    if (stored?.access) {
      const result = await dispatch(fetchMe())
      if (fetchMe.rejected.match(result)) {
        clearAuth()
        dispatch(authCleared())
      }
    }
    return true
  }
)

export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async ({ email }, { rejectWithValue }) => {
    try {
      return await apiPost('/api/password-reset', { email }, { auth: false })
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

export const confirmPasswordReset = createAsyncThunk(
  'auth/confirmPasswordReset',
  async ({ token, password }, { rejectWithValue }) => {
    try {
      return await apiPost('/api/password-reset/confirm', { token, password }, { auth: false })
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Fired when the api client gives up on refreshing an expired token
    // (window 'asg:unauthorized' event) or after a failed bootstrap check.
    authCleared(state) {
      state.user = null
      state.access = null
      state.refresh = null
      state.status = 'idle'
      state.error = null
      state.fieldErrors = {}
    },
  },
  extraReducers: (builder) => {
    builder
      // register
      .addCase(register.pending, (state) => {
        state.status = 'pending'
        state.error = null
        state.fieldErrors = {}
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.user = action.payload.user
        state.access = action.payload.access
        state.refresh = action.payload.refresh
        state.error = null
        state.fieldErrors = {}
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Registration failed.'
        state.fieldErrors = action.payload?.errors || {}
      })

      // login
      .addCase(login.pending, (state) => {
        state.status = 'pending'
        state.error = null
        state.fieldErrors = {}
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.user = action.payload.user
        state.access = action.payload.access
        state.refresh = action.payload.refresh
        state.error = null
        state.fieldErrors = {}
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Sign in failed.'
        state.fieldErrors = action.payload?.errors || {}
      })

      // logout — thunk never rejects, it always resolves after clearing storage
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.access = null
        state.refresh = null
        state.status = 'idle'
        state.error = null
        state.fieldErrors = {}
      })

      // fetchMe
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.error = action.payload?.detail || state.error
      })

      // bootstrap
      .addCase(bootstrap.fulfilled, (state) => {
        state.bootstrapped = true
      })
      .addCase(bootstrap.rejected, (state) => {
        state.bootstrapped = true
      })

      // requestPasswordReset
      .addCase(requestPasswordReset.pending, (state) => {
        state.status = 'pending'
        state.error = null
        state.fieldErrors = {}
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
        state.status = 'fulfilled'
        state.error = null
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Request failed.'
        state.fieldErrors = action.payload?.errors || {}
      })

      // confirmPasswordReset
      .addCase(confirmPasswordReset.pending, (state) => {
        state.status = 'pending'
        state.error = null
        state.fieldErrors = {}
      })
      .addCase(confirmPasswordReset.fulfilled, (state) => {
        state.status = 'fulfilled'
        state.error = null
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Reset failed.'
        state.fieldErrors = action.payload?.errors || {}
      })
  },
})

export const { authCleared } = authSlice.actions
export default authSlice.reducer
