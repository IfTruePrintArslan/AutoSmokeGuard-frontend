import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  fetchHistory,
  setFilter,
  setFilters,
  resetFilters,
  setPage,
  setPageSize,
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
