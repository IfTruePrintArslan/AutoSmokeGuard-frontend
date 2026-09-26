import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGet, ApiError } from '../../lib/api'

const initialState = {
  data: null, // whole GET /api/dashboard/stats response
  status: 'idle',
  error: null,
  lastFetched: null,
}

function extractRejection(err) {
  if (err instanceof ApiError) return { detail: err.detail, code: err.code }
  return { detail: err?.message || 'Something went wrong.', code: null }
}

export const fetchStats = createAsyncThunk(
  'dashboard/fetchStats',
  async (days = 30, { rejectWithValue }) => {
    try {
      return await apiGet(`/api/dashboard/stats?days=${days}`)
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStats.pending, (state) => {
        state.status = 'pending'
        state.error = null
      })
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.data = action.payload
        state.lastFetched = Date.now()
      })
      .addCase(fetchStats.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Failed to load dashboard stats.'
      })
  },
})

export default dashboardSlice.reducer
