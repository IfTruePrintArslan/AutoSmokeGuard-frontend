import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AnalysisPage from '../AnalysisPage'
import analysisReducer from '../../features/analysis/analysisSlice'
import historyReducer from '../../features/history/historySlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
  }
})

const runningDetail = {
  analysis_id: 'a1',
  media: { media_id: 'm1', filename: 'clip.mp4', media_type: 'video', url: '/media/x.mp4' },
  status: 'running',
  progress: 40,
  created_at: '2026-01-01T00:00:00Z',
  start_time: '2026-01-01T00:00:00Z',
  end_time: null,
  duration_seconds: null,
  total_vehicles: 0,
  total_smoke: 0,
  avg_confidence: null,
  overall_severity: null,
  severity_counts: { low: 0, moderate: 0, high: 0 },
  preview_url: null,
  report: null,
  settings_snapshot: {},
  frames_processed: 0,
  error_message: '',
  annotated_frames: [],
  vehicles: [],
  segmenter_mode: 'unet',
  device: 'cpu',
}

const doneDetail = {
  ...runningDetail,
  status: 'done',
  progress: 100,
  end_time: '2026-01-01T00:05:00Z',
  duration_seconds: 12,
  total_vehicles: 2,
  total_smoke: 1,
  avg_confidence: 0.9,
  overall_severity: 'high',
  severity_counts: { low: 0, moderate: 0, high: 1 },
  frames_processed: 10,
  report: null,
  vehicles: [
    {
      vehicle_id: 'v1',
      vehicle_type: 'car',
      bounding_box: { x: 0, y: 0, w: 10, h: 10 },
      confidence: 0.9,
      frame_number: 5,
      timestamp_seconds: 1.2,
      crop_path: null,
      smoke: {
        smoke_id: 's1',
        mask_path: '/media/mask.png',
        intensity: 0.7,
        severity: 'high',
        confidence: 0.8,
        area_ratio: 0.2,
        opacity: 0.5,
      },
    },
  ],
}

function renderAnalysisDetail(analysisId) {
  const store = configureStore({ reducer: { analysis: analysisReducer, history: historyReducer } })
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/analysis/${analysisId}`]}>
        <Routes>
          <Route path="/analysis/:analysisId" element={<AnalysisPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  return { store, ...utils }
}

describe('AnalysisPage detail view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the running progress percentage with an accessible progressbar', async () => {
    api.apiGet.mockResolvedValue(runningDetail)

    renderAnalysisDetail('a1')

    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText('clip.mp4')).toBeInTheDocument()
  })

  it('polls GET /api/status/{analysisId} directly on a cold load, so `stage` is shown', async () => {
    // No startAnalysis/pollStatus dispatched in this SPA session first — this
    // mirrors landing on /analysis/:analysisId via a History link or a page
    // refresh, where no job_id is known up front. job_id === analysis_id
    // (see API_CONTRACT.md), so /api/status/{analysisId} must be polled
    // directly rather than falling back to the stage-less analysis detail.
    api.apiGet.mockImplementation((path) => {
      if (path === '/api/status/a1') {
        return Promise.resolve({
          job_id: 'a1', analysis_id: 'a1', status: 'running', progress: 55,
          stage: 'segmenting frames', started_at: '2026-01-01T00:00:00Z', ended_at: null,
          error_message: '', report_id: null,
          total_vehicles: 0, total_smoke: 0, overall_severity: null,
        })
      }
      return Promise.resolve(runningDetail)
    })

    renderAnalysisDetail('a1')

    expect(await screen.findByText(/segmenting frames/i)).toBeInTheDocument()
    expect(api.apiGet).toHaveBeenCalledWith('/api/status/a1')
  })

  it('transitions to the results view once a polled status flips to done', async () => {
    api.apiGet.mockResolvedValue(runningDetail)
    const { store } = renderAnalysisDetail('a1')

    await screen.findByRole('progressbar')

    // Simulate the poll resolving with a terminal "done" status — this is
    // exactly what the fetchAnalysis/pollStatus thunks dispatch on success.
    await act(async () => {
      store.dispatch({ type: 'analysis/fetchAnalysis/fulfilled', payload: doneDetail })
    })

    expect(await screen.findByRole('button', { name: /generate pdf report/i })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
