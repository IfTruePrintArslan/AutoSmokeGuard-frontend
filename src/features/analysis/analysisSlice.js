import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGet, apiPost, apiDelete, ApiError } from '../../lib/api'

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
  polling: {},
}

function extractRejection(err) {
  if (err instanceof ApiError) {
    return { detail: err.detail, code: err.code, errors: err.fieldErrors }
  }
  return { detail: err?.message || 'Something went wrong.', code: null, errors: {} }
}

// UI `frameSampling` value -> API `frame_sample_rate` (analyze every Nth frame).
const FRAME_RATE_MAP = { every1: 1, every5: 5, every10: 10 }

// Pure mapper: UI settings -> the contract's POST /api/analyze `settings` shape.
// `sensitivity` (0 = least sensitive .. 100 = most sensitive) is mapped
// LINEARLY and INVERTED onto `confidence_threshold`, clamped to the
// contract's documented 0.15..0.75 range: a high sensitivity should accept
// lower-confidence detections (low threshold), a low sensitivity should
// require high-confidence detections (high threshold).
//   sensitivity=0   -> confidence_threshold=0.75 (least sensitive)
//   sensitivity=100 -> confidence_threshold=0.15 (most sensitive)
// `plateRedaction` / `nightMode` are presentational-only toggles the API
// contract does not define a field for, so they are intentionally omitted.
export function toApiSettings(settings) {
  const clampedSensitivity = Math.min(100, Math.max(0, settings.sensitivity ?? 50))
  const confidence_threshold = Number(
    (0.75 - (clampedSensitivity / 100) * (0.75 - 0.15)).toFixed(2)
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
  },
  extraReducers: (builder) => {
    builder
      // startAnalysis
      .addCase(startAnalysis.fulfilled, (state, action) => {
        state.current = action.payload
        state.polling[action.payload.job_id] = action.payload
      })

      // pollStatus
      .addCase(pollStatus.fulfilled, (state, action) => {
        state.polling[action.payload.job_id] = action.payload
        if (state.current?.job_id === action.payload.job_id) {
          state.current = action.payload
        }
      })
      .addCase(pollStatus.rejected, (state, action) => {
        const job_id = action.payload?.job_id
        if (job_id && state.polling[job_id]) {
          state.polling[job_id] = {
            ...state.polling[job_id],
            status: 'failed',
            error_message: action.payload?.detail || 'Failed to fetch status.',
          }
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
        if (state.current?.analysis_id === action.payload) state.current = null
      })
  },
})

export const { setSetting, clearCurrent } = analysisSlice.actions
export default analysisSlice.reducer
