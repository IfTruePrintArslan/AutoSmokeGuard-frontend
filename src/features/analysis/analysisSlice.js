import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import { apiGet, apiPost, apiDelete, ApiError } from '../../lib/api'

// Status vocabulary: 'pending' | 'queued' | 'running' | 'done' | 'failed'
// (API_CONTRACT.md). Only the last two are terminal. Exported so every
// consumer shares one definition instead of re-declaring the set per file.
export const TERMINAL_STATUSES = Object.freeze(['done', 'failed'])
const TERMINAL = new Set(TERMINAL_STATUSES)

export function isTerminalStatus(status) {
  return TERMINAL.has(status)
}

// How many *consecutive* transport failures a job may accumulate before the
// UI is allowed to tell the user anything is wrong. A single dropped poll is
// a Wi-Fi hiccup, a 429 from the `user` throttle or a 502 mid-deploy — none
// of those say anything about the analysis itself.
export const POLL_FAILURE_THRESHOLD = 3

const initialState = {
  settings: {
    model: 'yolov8-2.3',
    frameSampling: 'every5',
    sensitivity: 68,
    autoPdf: true,
    plateRedaction: true,
    nightMode: false,
  },
  // Most recently started/polled StatusObj — drives the "just started" UX
  // right after Upload -> Start analysis without waiting on a fetch round-trip.
  current: null,
  // Full AnalysisDetail objects, keyed by analysis_id.
  detail: { byId: {}, status: 'idle', error: null },
  // Live StatusObj snapshots keyed by job_id — powers the dashboard
  // processing queue and the /analysis index's "in progress" list.
  //
  // Entries are pruned when the job reaches a terminal state, when its full
  // detail lands terminal, and when it is deleted, so a finished or removed
  // job can never keep a "N running" badge alive for the rest of the session.
  polling: {},
  // Transport-level poll failures, keyed by job_id:
  //   { consecutive: number, detail: string, code: string|null }
  // Deliberately SEPARATE from `polling`: a request that failed to reach the
  // server says nothing about the pipeline, so it must never be written into
  // the job's `status` where it would be indistinguishable from a real
  // `status: 'failed'` and would tear down polling forever.
  pollErrors: {},
}

function extractRejection(err) {
  if (err instanceof ApiError) {
    return { status: err.status, detail: err.detail, code: err.code, errors: err.fieldErrors }
  }
  return { status: 0, detail: err?.message || 'Something went wrong.', code: null, errors: {} }
}

// Drops every terminal job from `polling` (and its error bookkeeping).
// `exceptId` keeps the job that was *just* polled, so a detail view still
// observes its own queued -> done transition before the entry disappears.
function pruneTerminal(state, exceptId) {
  for (const id of Object.keys(state.polling)) {
    if (id === exceptId) continue
    if (isTerminalStatus(state.polling[id]?.status)) {
      delete state.polling[id]
      delete state.pollErrors[id]
    }
  }
}

function forgetJob(state, id) {
  if (id === undefined || id === null) return
  delete state.polling[id]
  delete state.pollErrors[id]
}

// UI `frameSampling` value -> API `frame_sample_rate` (analyze every Nth frame).
const FRAME_RATE_MAP = { every1: 1, every5: 5, every10: 10 }

// Ends of the confidence band the slider drives. The API itself is unbounded
// at the boundary and the server clamps to [0.05, 0.95]; this narrower band
// is a product decision about what the slider is allowed to ask for, not a
// documented contract range.
export const CONFIDENCE_MIN = 0.15
export const CONFIDENCE_MAX = 0.75

// Pure mapper: UI settings -> the contract's POST /api/analyze `settings` shape.
//
// `sensitivity` is a STRICTNESS dial, matching the track's Low | Balanced |
// Strict labelling left-to-right: turning it up must make the run *harder*
// to trip, never easier. It therefore maps LINEARLY and ASCENDING onto
// `confidence_threshold`:
//   sensitivity=0   -> confidence_threshold=0.15 (loosest, most false positives)
//   sensitivity=100 -> confidence_threshold=0.75 (strictest, highest bar)
// The server derives `smoke_mask_threshold` from the raw `sensitivity` it is
// sent and must use the same direction (0 -> 0.25 .. 100 -> 0.75 ascending);
// the contract has no client-settable field for it, so it is not sent here.
// `plateRedaction` / `nightMode` are presentational-only toggles the API
// contract does not define a field for, so they are intentionally omitted.
export function toApiSettings(settings) {
  const clampedSensitivity = Math.min(100, Math.max(0, settings.sensitivity ?? 50))
  const confidence_threshold = Number(
    (CONFIDENCE_MIN + (clampedSensitivity / 100) * (CONFIDENCE_MAX - CONFIDENCE_MIN)).toFixed(2)
  )
  return {
    confidence_threshold,
    frame_sample_rate: FRAME_RATE_MAP[settings.frameSampling] ?? 5,
    sensitivity: clampedSensitivity,
    auto_generate_pdf: !!settings.autoPdf,
    model: settings.model,
  }
}

export const startAnalysis = createAsyncThunk(
  'analysis/startAnalysis',
  async ({ media_id, settings }, { rejectWithValue }) => {
    try {
      const body = { media_id }
      if (settings) body.settings = toApiSettings(settings)
      return await apiPost('/api/analyze', body)
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

// `job_id` and `analysis_id` are always equal (there is no separate Job
// table server-side — see API_CONTRACT.md, "Analysis" section) and either
// may be passed to GET /api/status/{...}. Callers dispatch this with an
// `analysis_id` in every case, including a cold page load with no job_id
// known from an in-SPA startAnalysis call, so the response's `stage` is
// always available.
export const pollStatus = createAsyncThunk(
  'analysis/pollStatus',
  async (job_id, { rejectWithValue }) => {
    try {
      return await apiGet(`/api/status/${job_id}`)
    } catch (err) {
      return rejectWithValue({ job_id, ...extractRejection(err) })
    }
  }
)

export const fetchAnalysis = createAsyncThunk(
  'analysis/fetchAnalysis',
  async (analysis_id, { rejectWithValue }) => {
    try {
      return await apiGet(`/api/analysis/${analysis_id}`)
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

export const generateReport = createAsyncThunk(
  'analysis/generateReport',
  async (analysis_id, { rejectWithValue }) => {
    try {
      const report = await apiPost(`/api/analysis/${analysis_id}/report`, {})
      return { analysis_id, report }
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

export const deleteAnalysis = createAsyncThunk(
  'analysis/deleteAnalysis',
  async (analysis_id, { rejectWithValue }) => {
    try {
      await apiDelete(`/api/analysis/${analysis_id}`)
      return analysis_id
    } catch (err) {
      return rejectWithValue(extractRejection(err))
    }
  }
)

const analysisSlice = createSlice({
  name: 'analysis',
  initialState,
  reducers: {
    setSetting(state, action) {
      const { key, value } = action.payload
      state.settings[key] = value
    },
    clearCurrent(state) {
      state.current = null
    },
    // Stop tracking one job entirely (payload: job_id).
    clearPolling(state, action) {
      forgetJob(state, action.payload)
      if (state.current?.job_id === action.payload) state.current = null
    },
    // Sweep every finished job out of the tracked set.
    prunePolling(state) {
      pruneTerminal(state)
    },
    // Dismiss the "connection problem" state for one job so its Retry button
    // resumes from a clean slate (payload: job_id).
    clearPollError(state, action) {
      delete state.pollErrors[action.payload]
    },
  },
  extraReducers: (builder) => {
    builder
      // startAnalysis
      .addCase(startAnalysis.fulfilled, (state, action) => {
        state.current = action.payload
        state.polling[action.payload.job_id] = action.payload
        delete state.pollErrors[action.payload.job_id]
      })

      // pollStatus
      .addCase(pollStatus.fulfilled, (state, action) => {
        // StatusObj always carries job_id; fall back to the id that was
        // polled so a partial payload can never create a `polling[undefined]`
        // entry that no consumer can address.
        const job_id = action.payload?.job_id ?? action.payload?.analysis_id ?? action.meta.arg
        if (job_id === undefined || job_id === null) return
        state.polling[job_id] = action.payload
        // A successful round-trip clears the transport-error bookkeeping:
        // the counter only ever means "consecutive failures".
        delete state.pollErrors[job_id]
        // Opportunistic GC of everything that already finished. The job just
        // polled is exempt so its own terminal transition stays observable
        // to the view that is watching it.
        pruneTerminal(state, String(job_id))
        if (state.current?.job_id === job_id) {
          state.current = action.payload
        }
      })
      .addCase(pollStatus.rejected, (state, action) => {
        const job_id = action.payload?.job_id ?? action.meta.arg
        if (job_id === undefined || job_id === null) return
        // A transport failure MUST NOT synthesise a terminal status — doing
        // so is indistinguishable from a real pipeline failure and would
        // permanently kill a healthy analysis on a single dropped request.
        // The last known good StatusObj in `polling` is left exactly as it
        // was; only the separate failure counter moves, and the UI is
        // expected to stay in a recoverable "connection problem" state once
        // it crosses POLL_FAILURE_THRESHOLD.
        const prev = state.pollErrors[job_id]
        state.pollErrors[job_id] = {
          consecutive: (prev?.consecutive || 0) + 1,
          detail: action.payload?.detail || 'Failed to fetch status.',
          code: action.payload?.code ?? null,
          status: action.payload?.status ?? 0,
        }
      })

      // fetchAnalysis
      .addCase(fetchAnalysis.pending, (state) => {
        state.detail.status = 'pending'
        state.detail.error = null
      })
      .addCase(fetchAnalysis.fulfilled, (state, action) => {
        state.detail.status = 'fulfilled'
        state.detail.byId[action.payload.analysis_id] = action.payload
        // The authoritative detail supersedes the live snapshot: once it
        // comes back terminal there is nothing left to poll, so the job stops
        // being tracked (this is what retires a `queued` entry left behind by
        // a startAnalysis whose job finished while nobody was watching).
        if (isTerminalStatus(action.payload.status)) {
          forgetJob(state, action.payload.analysis_id)
        }
      })
      .addCase(fetchAnalysis.rejected, (state, action) => {
        state.detail.status = 'rejected'
        state.detail.error = action.payload?.detail || 'Failed to load analysis.'
      })

      // generateReport
      .addCase(generateReport.fulfilled, (state, action) => {
        const { analysis_id, report } = action.payload
        if (state.detail.byId[analysis_id]) {
          state.detail.byId[analysis_id].report = {
            report_id: report.report_id,
            generated_at: report.generated_at,
          }
        }
      })

      // deleteAnalysis
      .addCase(deleteAnalysis.fulfilled, (state, action) => {
        delete state.detail.byId[action.payload]
        // job_id === analysis_id, so the deleted row can be dropped from the
        // tracked set by the same id — otherwise it keeps counting towards
        // the sidebar's "N running" badge forever.
        forgetJob(state, action.payload)
        if (state.current?.analysis_id === action.payload) state.current = null
      })
  },
})

export const { setSetting, clearCurrent, clearPolling, prunePolling, clearPollError } =
  analysisSlice.actions

/* ───────────────────────── selectors ─────────────────────────
 * Every consumer of the tracked-job set must go through these: hand-rolling
 * `Object.values(state.analysis.polling).length` is what produced the phantom
 * "3 running" badge, and a memoised selector keeps the filter in one place
 * while giving useSelector a stable reference between unrelated updates.
 */
export const selectPolling = (state) => state.analysis.polling
export const selectPollErrors = (state) => state.analysis.pollErrors

export const selectActiveJobs = createSelector([selectPolling], (polling) =>
  Object.values(polling).filter((job) => !isTerminalStatus(job?.status))
)

export const selectActiveJobIds = createSelector([selectActiveJobs], (jobs) =>
  jobs.map((job) => job.job_id ?? job.analysis_id).filter(Boolean)
)

export const selectActiveJobCount = createSelector([selectActiveJobs], (jobs) => jobs.length)

export const selectJob = (job_id) => (state) =>
  job_id === undefined || job_id === null ? null : state.analysis.polling[job_id] || null

export const selectPollError = (job_id) => (state) =>
  job_id === undefined || job_id === null ? null : state.analysis.pollErrors[job_id] || null

// True only once the failures have piled up past the tolerance threshold —
// the signal a view should use to show a recoverable "connection problem"
// panel with a Retry, never a terminal "Analysis failed".
export const selectPollConnectionLost = (job_id) => (state) => {
  const err = selectPollError(job_id)(state)
  return !!err && err.consecutive >= POLL_FAILURE_THRESHOLD
}

export default analysisSlice.reducer
