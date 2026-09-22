import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, {
  toApiSettings,
  startAnalysis,
  pollStatus,
  fetchAnalysis,
  deleteAnalysis,
  clearPolling,
  prunePolling,
  clearPollError,
  selectActiveJobs,
  selectActiveJobCount,
  selectActiveJobIds,
  selectPollError,
  selectPollConnectionLost,
  isTerminalStatus,
  POLL_FAILURE_THRESHOLD,
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
} from '../analysisSlice'
import * as api from '../../../lib/api'

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
  }
})

function createTestStore() {
  return configureStore({ reducer: { analysis: reducer } })
}

function statusObj(job_id, overrides = {}) {
  return {
    job_id,
    analysis_id: job_id,
    status: 'running',
    progress: 40,
    stage: 'detecting vehicles',
    started_at: '2026-01-01T00:00:00Z',
    ended_at: null,
    error_message: '',
    report_id: null,
    ...overrides,
  }
}

/* ─────────────────── D7: the sensitivity control direction ─────────────── */
describe('toApiSettings sensitivity mapping (D7)', () => {
  const base = { model: 'yolov8-2.3', frameSampling: 'every5', autoPdf: true }

  it('maps the slider ASCENDING onto confidence_threshold — higher = stricter', () => {
    // The track reads Low | Balanced | Strict left to right, so the right
    // hand end must be the HIGHEST bar, not the loosest one. Getting this
    // backwards makes the "Strict" setting the most false-positive-prone
    // configuration the API allows, in output framed as evidence.
    expect(toApiSettings({ ...base, sensitivity: 0 }).confidence_threshold).toBe(CONFIDENCE_MIN)
    expect(toApiSettings({ ...base, sensitivity: 100 }).confidence_threshold).toBe(CONFIDENCE_MAX)
    expect(toApiSettings({ ...base, sensitivity: 0 }).confidence_threshold).toBe(0.15)
    expect(toApiSettings({ ...base, sensitivity: 100 }).confidence_threshold).toBe(0.75)
  })

  it('is strictly monotonic increasing across the whole track', () => {
    const thresholds = [0, 10, 25, 50, 68, 75, 90, 100].map(
      (sensitivity) => toApiSettings({ ...base, sensitivity }).confidence_threshold
    )
    for (let i = 1; i < thresholds.length; i += 1) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1])
    }
  })

  it('puts the midpoint at 0.45 and passes the raw sensitivity through unchanged', () => {
    const mapped = toApiSettings({ ...base, sensitivity: 50 })
    expect(mapped.confidence_threshold).toBe(0.45)
    // The server derives smoke_mask_threshold from this value and must use
    // the same direction, so it has to arrive un-inverted.
    expect(mapped.sensitivity).toBe(50)
  })

  it('clamps out-of-range slider values before mapping', () => {
    expect(toApiSettings({ ...base, sensitivity: -20 }).confidence_threshold).toBe(0.15)
    expect(toApiSettings({ ...base, sensitivity: 900 }).confidence_threshold).toBe(0.75)
    expect(toApiSettings({ ...base, sensitivity: undefined }).confidence_threshold).toBe(0.45)
  })

  it('maps frame sampling and the pdf toggle, and omits presentational toggles', () => {
    const mapped = toApiSettings({ ...base, frameSampling: 'every10', sensitivity: 50, autoPdf: false, plateRedaction: true, nightMode: true })
    expect(mapped.frame_sample_rate).toBe(10)
    expect(mapped.auto_generate_pdf).toBe(false)
    expect(mapped).not.toHaveProperty('plateRedaction')
    expect(mapped).not.toHaveProperty('nightMode')
  })
})

/* ──────── D2: a failed poll must not fabricate a terminal failure ──────── */
describe('pollStatus transport failures (D2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function pollOnce(store, job_id, impl) {
    api.apiGet.mockImplementationOnce(impl)
    return store.dispatch(pollStatus(job_id))
  }

  it('leaves the last known good status untouched when a poll fails', async () => {
    const store = createTestStore()
    api.apiPost.mockResolvedValueOnce(statusObj('j1', { status: 'queued', progress: 0 }))
    await store.dispatch(startAnalysis({ media_id: 'm1' }))

    await pollOnce(store, 'j1', async () => statusObj('j1', { status: 'running', progress: 62 }))
    await pollOnce(store, 'j1', async () => {
      throw new api.ApiError({ status: 429, code: 'throttled', detail: 'Request was throttled.' })
    })

    const state = store.getState().analysis
    // The single most important assertion in this file: a dropped request is
    // NOT a failed analysis.
    expect(state.polling.j1.status).toBe('running')
    expect(state.polling.j1.progress).toBe(62)
    expect(state.polling.j1.error_message).toBe('')
    expect(isTerminalStatus(state.polling.j1.status)).toBe(false)
  })

  it('counts consecutive failures separately and only reports a connection problem past the threshold', async () => {
    const store = createTestStore()
    api.apiPost.mockResolvedValueOnce(statusObj('j1', { status: 'queued' }))
    await store.dispatch(startAnalysis({ media_id: 'm1' }))

    const boom = async () => {
      throw new api.ApiError({ status: 0, code: 'network_error', detail: 'Network error. Please check your connection.' })
    }

    for (let i = 1; i < POLL_FAILURE_THRESHOLD; i += 1) {
      await pollOnce(store, 'j1', boom)
      expect(selectPollError('j1')(store.getState()).consecutive).toBe(i)
      expect(selectPollConnectionLost('j1')(store.getState())).toBe(false)
    }

    await pollOnce(store, 'j1', boom)
    expect(selectPollError('j1')(store.getState()).consecutive).toBe(POLL_FAILURE_THRESHOLD)
    expect(selectPollConnectionLost('j1')(store.getState())).toBe(true)
    // Still recoverable — the job is not terminal, so polling may resume.
    expect(store.getState().analysis.polling.j1.status).toBe('queued')
  })

  it('resets the failure counter as soon as one poll gets through', async () => {
    const store = createTestStore()
    const boom = async () => {
      throw new api.ApiError({ status: 502, code: 'server_error', detail: 'Bad gateway.' })
    }
    await pollOnce(store, 'j1', boom)
    await pollOnce(store, 'j1', boom)
    expect(selectPollError('j1')(store.getState()).consecutive).toBe(2)

    await pollOnce(store, 'j1', async () => statusObj('j1', { status: 'running', progress: 80 }))

    expect(selectPollError('j1')(store.getState())).toBeNull()
    expect(selectPollConnectionLost('j1')(store.getState())).toBe(false)
    expect(store.getState().analysis.polling.j1.progress).toBe(80)
  })

  it('records a failure for a job that has no snapshot yet without inventing one', async () => {
    const store = createTestStore()
    await pollOnce(store, 'cold', async () => {
      throw new api.ApiError({ status: 0, code: 'network_error', detail: 'Network error.' })
    })

    expect(store.getState().analysis.polling.cold).toBeUndefined()
    expect(selectPollError('cold')(store.getState()).consecutive).toBe(1)
  })

  it('clearPollError wipes the connection-problem state so Retry starts clean', async () => {
    const store = createTestStore()
    const boom = async () => {
      throw new api.ApiError({ status: 0, code: 'network_error', detail: 'Network error.' })
    }
    for (let i = 0; i < POLL_FAILURE_THRESHOLD; i += 1) await pollOnce(store, 'j1', boom)
    expect(selectPollConnectionLost('j1')(store.getState())).toBe(true)

    store.dispatch(clearPollError('j1'))

    expect(selectPollConnectionLost('j1')(store.getState())).toBe(false)
  })

  it('a genuine server-reported failure is the only thing that sets a terminal failed status', async () => {
    const store = createTestStore()
    await pollOnce(store, 'j1', async () =>
      statusObj('j1', { status: 'failed', progress: 30, error_message: 'Segmenter crashed.' })
    )

    expect(store.getState().analysis.polling.j1.status).toBe('failed')
    expect(store.getState().analysis.polling.j1.error_message).toBe('Segmenter crashed.')
  })
})

/* ────────── D4: the polling map must not accumulate phantom jobs ───────── */
describe('polling map lifecycle (D4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function startThree(store) {
    for (const id of ['j1', 'j2', 'j3']) {
      api.apiPost.mockResolvedValueOnce(statusObj(id, { status: 'queued', progress: 0 }))
      await store.dispatch(startAnalysis({ media_id: `m-${id}` }))
    }
  }

  it('selectActiveJobCount counts only non-terminal jobs', async () => {
    const store = createTestStore()
    await startThree(store)
    expect(selectActiveJobCount(store.getState())).toBe(3)

    api.apiGet.mockResolvedValueOnce(statusObj('j1', { status: 'done', progress: 100 }))
    await store.dispatch(pollStatus('j1'))

    expect(selectActiveJobCount(store.getState())).toBe(2)
    expect(selectActiveJobIds(store.getState())).toEqual(['j2', 'j3'])
  })

  it('deleteAnalysis.fulfilled stops tracking the deleted job', async () => {
    const store = createTestStore()
    await startThree(store)
    api.apiDelete.mockResolvedValueOnce(null)

    await store.dispatch(deleteAnalysis('j2'))

    expect(store.getState().analysis.polling.j2).toBeUndefined()
    expect(selectActiveJobCount(store.getState())).toBe(2)
    expect(selectActiveJobIds(store.getState())).toEqual(['j1', 'j3'])
  })

  it('deleteAnalysis.fulfilled also drops the job error bookkeeping and detail', async () => {
    const store = createTestStore()
    await startThree(store)
    api.apiGet.mockRejectedValueOnce(new api.ApiError({ status: 0, code: 'network_error', detail: 'Network error.' }))
    await store.dispatch(pollStatus('j2'))
    api.apiGet.mockResolvedValueOnce({ analysis_id: 'j2', status: 'running' })
    await store.dispatch(fetchAnalysis('j2'))
    expect(selectPollError('j2')(store.getState())).not.toBeNull()

    api.apiDelete.mockResolvedValueOnce(null)
    await store.dispatch(deleteAnalysis('j2'))

    expect(selectPollError('j2')(store.getState())).toBeNull()
    expect(store.getState().analysis.detail.byId.j2).toBeUndefined()
  })

  it('a terminal detail fetch retires the job, so a queued-forever entry cannot survive a visit', async () => {
    const store = createTestStore()
    await startThree(store)
    // j1 finished while nobody was polling it — the /analysis/:id page's
    // one-shot detail fetch is what discovers that.
    api.apiGet.mockResolvedValueOnce({ analysis_id: 'j1', status: 'done', progress: 100 })

    await store.dispatch(fetchAnalysis('j1'))

    expect(store.getState().analysis.polling.j1).toBeUndefined()
    expect(selectActiveJobCount(store.getState())).toBe(2)
  })

  it('a still-running detail fetch leaves the job tracked', async () => {
    const store = createTestStore()
    await startThree(store)
    api.apiGet.mockResolvedValueOnce({ analysis_id: 'j1', status: 'running', progress: 10 })

    await store.dispatch(fetchAnalysis('j1'))

    expect(store.getState().analysis.polling.j1).toBeDefined()
    expect(selectActiveJobCount(store.getState())).toBe(3)
  })

  it('keeps the just-polled terminal job visible so the detail view can observe the transition', async () => {
    const store = createTestStore()
    await startThree(store)
    api.apiGet.mockResolvedValueOnce(statusObj('j1', { status: 'done', progress: 100 }))

    await store.dispatch(pollStatus('j1'))

    expect(store.getState().analysis.polling.j1.status).toBe('done')
  })

  it('sweeps finished jobs opportunistically on the next successful poll of another job', async () => {
    const store = createTestStore()
    await startThree(store)
    api.apiGet.mockResolvedValueOnce(statusObj('j1', { status: 'done', progress: 100 }))
    await store.dispatch(pollStatus('j1'))
    api.apiGet.mockResolvedValueOnce(statusObj('j2', { status: 'running', progress: 20 }))
    await store.dispatch(pollStatus('j2'))

    expect(store.getState().analysis.polling.j1).toBeUndefined()
    expect(Object.keys(store.getState().analysis.polling).sort()).toEqual(['j2', 'j3'])
  })

  it('prunePolling sweeps every terminal job on demand', async () => {
    const store = createTestStore()
    await startThree(store)
    api.apiGet.mockResolvedValueOnce(statusObj('j1', { status: 'failed' }))
    await store.dispatch(pollStatus('j1'))

    store.dispatch(prunePolling())

    expect(Object.keys(store.getState().analysis.polling).sort()).toEqual(['j2', 'j3'])
  })

  it('clearPolling drops one job by id and clears it from `current`', async () => {
    const store = createTestStore()
    await startThree(store)

    store.dispatch(clearPolling('j3'))

    expect(store.getState().analysis.polling.j3).toBeUndefined()
    expect(store.getState().analysis.current).toBeNull()
    expect(selectActiveJobCount(store.getState())).toBe(2)
  })

  it('selectActiveJobs is memoised — an unrelated dispatch does not change its identity', async () => {
    const store = createTestStore()
    await startThree(store)
    const first = selectActiveJobs(store.getState())

    store.dispatch({ type: 'unrelated/action' })

    expect(selectActiveJobs(store.getState())).toBe(first)
  })

  it('never creates an unaddressable polling[undefined] entry from a partial payload', async () => {
    const store = createTestStore()
    api.apiGet.mockResolvedValueOnce({ status: 'running', progress: 5 })

    await store.dispatch(pollStatus('j9'))

    expect(store.getState().analysis.polling).not.toHaveProperty('undefined')
    expect(store.getState().analysis.polling.j9.progress).toBe(5)
  })
})
