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
  // True when the last fetch asked for a page the server no longer has (DRF
  // answers `NotFound` for any page past the end). Deleting the only row on
  // the last page is the common way to get here. The page component is
  // expected to react by clamping to `pages` — see the note on the rejected
  // reducer below.
  pageOutOfRange: false,
}

function extractRejection(err) {
  if (err instanceof ApiError) return { status: err.status, detail: err.detail, code: err.code }
  return { status: 0, detail: err?.message || 'Something went wrong.', code: null }
}

// DRF's pagination raises `NotFound` for an out-of-range page; the project's
// exception handler renders that as 404 + `code: 'not_found'`.
function isPageOutOfRange(payload) {
  return payload?.status === 404 || payload?.code === 'not_found'
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
        state.pageOutOfRange = false
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.status = 'fulfilled'
        state.items = action.payload.results
        state.count = action.payload.count
        state.page = action.payload.page
        state.pages = action.payload.pages
        state.pageSize = action.payload.page_size
        state.pageOutOfRange = false
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.status = 'rejected'
        state.error = action.payload?.detail || 'Failed to load history.'
        if (!isPageOutOfRange(action.payload)) return
        // The requested page is gone (the last row on it was just deleted).
        // Leaving `items` untouched would keep rendering rows the server has
        // confirmed do not exist — including the one the user just deleted,
        // whose View link now 404s. Drop them, and point `pages` at the
        // best-known last valid page so the component can clamp `page` to it
        // and refetch. `count` is left alone: it is the pre-delete total and
        // is the only basis the clamp has; `pageOutOfRange` is the signal.
        state.items = []
        state.pages = Math.max(1, state.page - 1)
        state.pageOutOfRange = true
      })
  },
})

export const { setFilter, setFilters, resetFilters, setPage, setPageSize } = historySlice.actions

// The page the component should clamp to after an out-of-range fetch, or
// null when nothing needs clamping. Dispatch `setPage(...)` with it and the
// existing fetch effect re-runs against a page that exists.
export const selectHistoryFallbackPage = (state) =>
  state.history.pageOutOfRange && state.history.page > 1 ? state.history.pages : null

export default historySlice.reducer
