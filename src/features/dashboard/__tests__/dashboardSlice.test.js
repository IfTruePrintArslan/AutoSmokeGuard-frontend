import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { fetchStats } from '../dashboardSlice'
import * as api from '../../../lib/api'

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

function createTestStore() {
  return configureStore({ reducer: { dashboard: reducer } })
}

describe('dashboardSlice reducer', () => {
  it('has the expected initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state).toEqual({ data: null, status: 'idle', error: null, lastFetched: null })
  })
})

describe('dashboardSlice thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchStats: fulfilled stores the whole response and stamps lastFetched', async () => {
    const payload = {
      totals: { analyses: 5, high_severity: 1, reports: 3, avg_confidence: 0.9 },
      sparklines: { analyses: [1, 2], high: [0, 1], reports: [1, 1], confidence: [0.8, 0.9] },
      detections_over_time: [{ date: '2026-01-01', label: 'Jan 1', detections: 2, high: 0 }],
      severity_distribution: [{ key: 'low', label: 'Low', value: 5, pct: 100, color: '#4ade80' }],
      recent_analyses: [],
      processing_queue: [],
    }
    api.apiGet.mockResolvedValueOnce(payload)
    const store = createTestStore()

    await store.dispatch(fetchStats(30))

    const state = store.getState().dashboard
    expect(state.status).toBe('fulfilled')
    expect(state.data).toEqual(payload)
    expect(state.lastFetched).toEqual(expect.any(Number))
    expect(api.apiGet).toHaveBeenCalledWith('/api/dashboard/stats?days=30')
  })

  it('fetchStats: defaults to 30 days when called with no argument', async () => {
    api.apiGet.mockResolvedValueOnce({})
    const store = createTestStore()

    await store.dispatch(fetchStats())

    expect(api.apiGet).toHaveBeenCalledWith('/api/dashboard/stats?days=30')
  })

  it('fetchStats: rejected surfaces the error detail and leaves data untouched', async () => {
    const err = new api.ApiError({ status: 500, code: 'server_error', detail: 'Boom.' })
    api.apiGet.mockRejectedValueOnce(err)
    const store = createTestStore()

    const result = await store.dispatch(fetchStats(30))

    expect(fetchStats.rejected.match(result)).toBe(true)
    const state = store.getState().dashboard
    expect(state.status).toBe('rejected')
    expect(state.error).toBe('Boom.')
    expect(state.data).toBeNull()
  })
})
