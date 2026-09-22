import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGet, ApiError } from '../../lib/api'

const initialState = {
  items: [],
  count: 0,
  page: 1,
  pages: 1,
  pageSize: 10,
  filters: {
    severity: '',
    vehicle_type: '',
    status: '',
    date_from: '',
    date_to: '',
    search: '',
    ordering: '-created_at',
  },
  status: 'idle',
  error: null,
}

function extractRejection(err) {
  if (err instanceof ApiError) return { detail: err.detail, code: err.code }
  return { detail: err?.message || 'Something went wrong.', code: null }
}

export const fetchHistory = createAsyncThunk(
  'history/fetchHistory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value)
      })
      const qs = query.toString()
      return await apiGet(`/api/history${qs ? `?${qs}` : ''}`)
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    setFilter(state, action) {
      const { key, value } = action.payload
      state.filters[key] = value
      state.page = 1
    },
    setFilters(state, action) {
      Object.assign(state.filters, action.payload)
      state.page = 1
    },
    resetFilters(state) {
      state.filters = initialState.filters
      state.page = 1
    },
    setPage(state, action) {
      state.page = action.payload
    },
    setPageSize(state, action) {
      state.pageSize = action.payload
      state.page = 1
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHistory.pending, (state) => {
        state.status = 'pending'
        state.error = null
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.items = action.payload.results
        state.count = action.payload.count
        state.page = action.payload.page
        state.pages = action.payload.pages
        state.pageSize = action.payload.page_size
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Failed to load history.'
      })
  },
})

export const { setFilter, setFilters, resetFilters, setPage, setPageSize } = historySlice.actions
export default historySlice.reducer
