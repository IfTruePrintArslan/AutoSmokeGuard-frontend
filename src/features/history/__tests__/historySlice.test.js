import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  fetchHistory,
  setFilter,
  setFilters,
  resetFilters,
  setPage,
  setPageSize,
  selectHistoryFallbackPage,
} from '../historySlice'
import * as api from '../../../lib/api'

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

function createTestStore() {
  return configureStore({ reducer: { history: reducer } })
}

describe('historySlice reducer', () => {
  it('has the expected initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state.items).toEqual([])
    expect(state.count).toBe(0)
    expect(state.page).toBe(1)
    expect(state.pageSize).toBe(10)
    expect(state.filters.ordering).toBe('-created_at')
    expect(state.status).toBe('idle')
  })

  it('setFilter updates a single filter and resets the page to 1', () => {
    let state = reducer(undefined, { type: '@@INIT' })
    state = reducer(state, setPage(3))
    state = reducer(state, setFilter({ key: 'severity', value: 'high' }))
    expect(state.filters.severity).toBe('high')
    expect(state.page).toBe(1)
  })

  it('setFilters merges multiple filters at once', () => {
    let state = reducer(undefined, { type: '@@INIT' })
    state = reducer(state, setFilters({ severity: 'low', vehicle_type: 'truck' }))
    expect(state.filters.severity).toBe('low')
    expect(state.filters.vehicle_type).toBe('truck')
  })

  it('resetFilters restores every filter to its default', () => {
    let state = reducer(undefined, { type: '@@INIT' })
    state = reducer(state, setFilters({ severity: 'high', search: 'clip' }))
    state = reducer(state, resetFilters())
    expect(state.filters.severity).toBe('')
    expect(state.filters.search).toBe('')
    expect(state.filters.ordering).toBe('-created_at')
  })

  it('setPageSize updates page size and resets to page 1', () => {
    let state = reducer(undefined, { type: '@@INIT' })
    state = reducer(state, setPage(5))
    state = reducer(state, setPageSize(25))
    expect(state.pageSize).toBe(25)
    expect(state.page).toBe(1)
  })
})

describe('historySlice thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchHistory: fulfilled stores the paginated results', async () => {
    api.apiGet.mockResolvedValueOnce({
      count: 2,
      page: 1,
      pages: 1,
      page_size: 10,
      results: [{ analysis_id: 'a1' }, { analysis_id: 'a2' }],
    })
    const store = createTestStore()

    await store.dispatch(fetchHistory({ page: 1, page_size: 10 }))

    const state = store.getState().history
    expect(state.status).toBe('fulfilled')
    expect(state.items).toHaveLength(2)
    expect(state.count).toBe(2)
    expect(api.apiGet).toHaveBeenCalledWith('/api/history?page=1&page_size=10')
  })

  it('fetchHistory: only includes non-empty params in the querystring', async () => {
    api.apiGet.mockResolvedValueOnce({ count: 0, page: 1, pages: 1, page_size: 10, results: [] })
    const store = createTestStore()

    await store.dispatch(fetchHistory({ page: 1, page_size: 10, severity: '', search: 'clip' }))

    expect(api.apiGet).toHaveBeenCalledWith('/api/history?page=1&page_size=10&search=clip')
  })

  it('fetchHistory: rejected surfaces the error detail', async () => {
    const err = new api.ApiError({ status: 500, code: 'server_error', detail: 'Boom.' })
    api.apiGet.mockRejectedValueOnce(err)
    const store = createTestStore()

    const result = await store.dispatch(fetchHistory({}))

    expect(fetchHistory.rejected.match(result)).toBe(true)
    expect(store.getState().history.status).toBe('rejected')
    expect(store.getState().history.error).toBe('Boom.')
  })
})

/* ───────── D13: deleting the last row on a page must not leave it ──────── */
describe('historySlice out-of-range pages (D13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 11 rows, page size 10: page 2 holds exactly one row. Deleting it and
  // refetching ?page=2 makes DRF raise NotFound -> 404.
  async function loadLastPageThenDeleteIt(store) {
    api.apiGet.mockResolvedValueOnce({
      count: 11,
      page: 2,
      pages: 2,
      page_size: 10,
      results: [{ analysis_id: 'doomed' }],
    })
    await store.dispatch(fetchHistory({ page: 2, page_size: 10 }))

    api.apiGet.mockRejectedValueOnce(
      new api.ApiError({ status: 404, code: 'not_found', detail: 'Invalid page.' })
    )
    await store.dispatch(fetchHistory({ page: 2, page_size: 10 }))
  }

  it('clears the stale rows instead of re-rendering the row that was just deleted', async () => {
    const store = createTestStore()
    await loadLastPageThenDeleteIt(store)

    const state = store.getState().history
    // The deleted row must be gone — leaving it rendered under a green
    // "Analysis deleted." toast, with a View link that 404s, is the bug.
    expect(state.items).toEqual([])
    expect(state.status).toBe('rejected')
  })

  it('exposes the page the component should clamp to', async () => {
    const store = createTestStore()
    await loadLastPageThenDeleteIt(store)

    const state = store.getState().history
    expect(state.pageOutOfRange).toBe(true)
    expect(state.pages).toBe(1)
    expect(selectHistoryFallbackPage(store.getState())).toBe(1)
  })

  it('clears the out-of-range flag as soon as the clamped refetch starts', async () => {
    const store = createTestStore()
    await loadLastPageThenDeleteIt(store)
    expect(store.getState().history.pageOutOfRange).toBe(true)

    store.dispatch(setPage(1))
    api.apiGet.mockResolvedValueOnce({
      count: 10,
      page: 1,
      pages: 1,
      page_size: 10,
      results: Array.from({ length: 10 }, (_, i) => ({ analysis_id: `a${i}` })),
    })
    await store.dispatch(fetchHistory({ page: 1, page_size: 10 }))

    const state = store.getState().history
    expect(state.pageOutOfRange).toBe(false)
    expect(state.items).toHaveLength(10)
    expect(selectHistoryFallbackPage(store.getState())).toBeNull()
  })

  it('leaves the rows alone for an ordinary transport failure', async () => {
    const store = createTestStore()
    api.apiGet.mockResolvedValueOnce({
      count: 1,
      page: 1,
      pages: 1,
      page_size: 10,
      results: [{ analysis_id: 'a1' }],
    })
    await store.dispatch(fetchHistory({ page: 1, page_size: 10 }))

    api.apiGet.mockRejectedValueOnce(
      new api.ApiError({ status: 0, code: 'network_error', detail: 'Network error.' })
    )
    await store.dispatch(fetchHistory({ page: 1, page_size: 10 }))

    // A dropped request says nothing about what exists — keep showing what
    // we last knew, and do not ask the page to clamp anywhere.
    expect(store.getState().history.items).toHaveLength(1)
    expect(store.getState().history.pageOutOfRange).toBe(false)
    expect(selectHistoryFallbackPage(store.getState())).toBeNull()
  })

  it('never asks page 1 to clamp below itself', async () => {
    const store = createTestStore()
    api.apiGet.mockRejectedValueOnce(
      new api.ApiError({ status: 404, code: 'not_found', detail: 'Invalid page.' })
    )
    await store.dispatch(fetchHistory({ page: 1, page_size: 10 }))

    expect(store.getState().history.pages).toBe(1)
    expect(selectHistoryFallbackPage(store.getState())).toBeNull()
  })
})
