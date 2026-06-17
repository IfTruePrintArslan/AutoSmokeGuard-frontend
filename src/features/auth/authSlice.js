import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

const LS_KEY = 'asg_auth'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.user && parsed.token) {
        return { user: parsed.user, token: parsed.token }
      }
    }
  } catch {
    // ignore malformed data
  }
  return { user: null, token: null }
}

function saveToStorage(user, token) {
  localStorage.setItem(LS_KEY, JSON.stringify({ user, token }))
}

function removeFromStorage() {
  localStorage.removeItem(LS_KEY)
}

const hydrated = loadFromStorage()

const initialState = {
  user: hydrated.user,
  token: hydrated.token,
  status: 'idle', // 'idle' | 'pending' | 'fulfilled' | 'rejected'
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    if (!email || !password) {
      return rejectWithValue('Email and password are required.')
    }
    await new Promise((r) => setTimeout(r, 600))
    const name = email.includes('@') ? email.split('@')[0] : email
    const user = { name, email }
    const token = 'mock.' + btoa(email)
    saveToStorage(user, token)
    return { user, token }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async ({ name, email, password }, { rejectWithValue }) => {
    if (!name || !email || !password) {
      return rejectWithValue('All fields are required.')
    }
    await new Promise((r) => setTimeout(r, 600))
    const user = { name, email }
    const token = 'mock.' + btoa(email)
    saveToStorage(user, token)
    return { user, token }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.token = null
      state.status = 'idle'
      state.error = null
      removeFromStorage()
    },
  },
  extraReducers: (builder) => {
    // login
    builder
      .addCase(login.pending, (state) => {
        state.status = 'pending'
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.user = action.payload.user
        state.token = action.payload.token
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload || action.error.message
      })

    // register
    builder
      .addCase(register.pending, (state) => {
        state.status = 'pending'
        state.error = null
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.user = action.payload.user
        state.token = action.payload.token
        state.error = null
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload || action.error.message
      })
  },
})

export const { logout } = authSlice.actions
export default authSlice.reducer
