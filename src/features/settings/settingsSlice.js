import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGet, apiPatch, ApiError } from '../../lib/api'

const initialState = {
  data: null, // SettingsObj
  status: 'idle',
  error: null,
  fieldErrors: {},
  saveStatus: 'idle',
}

function extractRejection(err) {
  if (err instanceof ApiError) {
    return { detail: err.detail, code: err.code, errors: err.fieldErrors }
  }
  return { detail: err?.message || 'Something went wrong.', code: null, errors: {} }
}

export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      return await apiGet('/api/settings')
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (patch, { rejectWithValue }) => {
    try {
      return await apiPatch('/api/settings', patch)
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearFieldErrors(state) {
      state.fieldErrors = {}
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.status = 'pending'
        state.error = null
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.data = action.payload
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Failed to load settings.'
      })
      .addCase(saveSettings.pending, (state) => {
        state.saveStatus = 'pending'
        state.error = null
        state.fieldErrors = {}
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.saveStatus = 'fulfilled'
        state.data = action.payload
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.saveStatus = 'rejected'
        state.error = action.payload?.detail || 'Failed to save settings.'
        state.fieldErrors = action.payload?.errors || {}
      })
  },
})

export const { clearFieldErrors } = settingsSlice.actions
export default settingsSlice.reducer
