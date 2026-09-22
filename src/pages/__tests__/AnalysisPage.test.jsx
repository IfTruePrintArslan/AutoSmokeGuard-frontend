import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// `auto_generate_pdf` on, report not written yet — the exact race defect 3
// covers: the terminal status lands slightly before the server finishes
// the report.
//
// A factory, and `end_time` is stamped at call time on purpose: how long the
// client waits for a report is anchored on when the run finished *on the
// server* (see lib/reportBudget.js), so a fixture frozen at 2026-01-01 would
// describe an analysis whose report is years overdue — never one that is
// still being written. Every branch also returns a fresh object, which
// matters: react-redux bails out on a reference-equal slice, so reusing one
// object across resolved calls would never re-render and would falsely look
// like the poll "isn't happening".
const autoPdfDetail = (overrides = {}) => ({
  ...doneDetail,
  settings_snapshot: { auto_generate_pdf: true, frame_sample_rate: 5 },
  end_time: new Date().toISOString(),
  report: null,
  ...overrides,
})

// A done analysis with a preview + annotated frames, so the frame lightbox
// (`FrameLightbox`) can actually be opened.
const doneDetailWithFrames = {
  ...doneDetail,
  preview_url: '/media/preview.jpg',
  annotated_frames: ['/media/frame1.jpg', '/media/frame2.jpg'],
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

function renderAnalysisIndex(preloadedState) {
  const store = configureStore({
    reducer: { analysis: analysisReducer, history: historyReducer },
    preloadedState,
  })
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/analysis']}>
        <Routes>
          <Route path="/analysis" element={<AnalysisPage />} />
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

  it('transitions to the results view once the real poll→terminal→refetch path completes (D30)', async () => {
    // Drives the ACTUAL mechanism: usePolling(pollStatus, ...) ticks
    // /api/status/a1 (first immediately, then again after the ~1000ms
    // backoff); only once that poll itself reports "done" does the
    // `job && isTerminal` effect fire the follow-up `fetchAnalysis` that
    // populates the results view. Never manually dispatches
    // `fetchAnalysis/fulfilled` — that bypasses `pollStatus`/`job.status`
    // entirely and would pass even if the poll→terminal wiring were broken
    // (exactly how defect D2 survived under the old version of this test).
    let statusCalls = 0
    api.apiGet.mockImplementation((path) => {
      if (path === '/api/status/a1') {
        statusCalls += 1
        if (statusCalls === 1) {
          return Promise.resolve({
            job_id: 'a1', analysis_id: 'a1', status: 'running', progress: 40,
            stage: 'segmenting frames', started_at: '2026-01-01T00:00:00Z', ended_at: null,
            error_message: '', report_id: null,
            total_vehicles: 0, total_smoke: 0, overall_severity: null,
          })
        }
        return Promise.resolve({
          job_id: 'a1', analysis_id: 'a1', status: 'done', progress: 100,
          stage: 'done', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:05:00Z',
          error_message: '', report_id: null,
          total_vehicles: 2, total_smoke: 1, overall_severity: 'high',
        })
      }
      // GET /api/analysis/a1 — the mount-time detail fetch (before the poll
      // has ever reported "done") vs. the terminal-triggered refetch
      // (after it has).
      return Promise.resolve(statusCalls >= 2 ? doneDetail : runningDetail)
    })

    renderAnalysisDetail('a1')

    await screen.findByRole('progressbar')
    expect(api.apiGet).toHaveBeenCalledWith('/api/status/a1')

    // The second poll tick (real ~1000ms backoff) resolves "done", which
    // flips `isTerminal` and triggers the follow-up `fetchAnalysis`.
    expect(await screen.findByRole('button', { name: /generate pdf report/i }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(statusCalls).toBeGreaterThanOrEqual(2)
  }, 8000)

  it('the frame lightbox moves focus in on open, traps Tab, and restores focus to the trigger on close (D21)', async () => {
    api.apiGet.mockResolvedValue(doneDetailWithFrames)

    renderAnalysisDetail('a1')

    const openBtn = await screen.findByRole('button', { name: /open annotated frame viewer/i })
    openBtn.focus()
    expect(document.activeElement).toBe(openBtn)

    fireEvent.click(openBtn)
    const dialog = await screen.findByRole('dialog', { name: /annotated frame viewer/i })

    // Focus must move inside the dialog on open — specifically to the first
    // *enabled* focusable control ("Previous frame" is disabled at frame 1,
    // so "Next frame" is first) — never left on the trigger button behind
    // the full-screen overlay.
    const nextBtn = screen.getByRole('button', { name: 'Next frame' })
    expect(dialog.contains(nextBtn)).toBe(true)
    expect(document.activeElement).toBe(nextBtn)

    // Tab containment: Tab from the last focusable ("Close") must wrap back
    // to the first ("Next frame") rather than escaping to the page behind.
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    closeBtn.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(nextBtn)

    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(openBtn)
  })

  it('labels the detection count "Vehicle detections" (not "Vehicles") and explains it via a tooltip', async () => {
    api.apiGet.mockResolvedValue(doneDetail)

    renderAnalysisDetail('a1')

    expect(await screen.findByText('Vehicle detections')).toBeInTheDocument()
    // The count must never be re-labelled back to the misleading "Vehicles".
    expect(screen.queryByText('Vehicles detected')).not.toBeInTheDocument()

    const tooltipTrigger = screen.getByRole('button', { name: /what does "vehicle detections" mean/i })
    expect(tooltipTrigger).toHaveAttribute('aria-describedby')
    const tooltipId = tooltipTrigger.getAttribute('aria-describedby')
    expect(document.getElementById(tooltipId)).toHaveTextContent(/detections across sampled frames, not unique vehicles/i)

    // Sampling context (frames processed) sits right next to the number.
    expect(screen.getByText(/10 frames processed/i)).toBeInTheDocument()
  })

  it('shows "Preparing report…" — never "Generate PDF report" — while an auto-generated report is still being written, then swaps to Download once it lands', async () => {
    let calls = 0
    api.apiGet.mockImplementation(() => {
      calls += 1
      // calls 1-2 are the status poll + the initial detail fetch on mount;
      // the report only lands starting from the 3rd call, i.e. the first
      // report-poll attempt.
      if (calls <= 2) return Promise.resolve(autoPdfDetail())
      return Promise.resolve(autoPdfDetail({ report: { report_id: 'r1', generated_at: '2026-01-01T00:05:30Z' } }))
    })

    renderAnalysisDetail('a1')

    expect(await screen.findByText(/preparing report/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generate pdf report/i })).not.toBeInTheDocument()

    // The fast path must stay fast: widening the wait budget must not cost
    // the common case (a PDF written in well under a second) any latency —
    // the first poll attempt still fires at 500ms.
    expect(await screen.findByRole('button', { name: /download pdf/i }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generate pdf report/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/preparing report/i)).not.toBeInTheDocument()
  }, 10000)

  it('keeps waiting for the whole server budget — no manual button while the server is still allowed to be working', async () => {
    // report stays null: the server is slow, not finished.
    api.apiGet.mockImplementation(() => Promise.resolve(autoPdfDetail()))

    renderAnalysisDetail('a1')

    expect(await screen.findByText(/preparing report/i)).toBeInTheDocument()

    // The server gives itself REPORT_BUDGET_SECONDS (30s) to render a PDF.
    // The client used to give up after ~4.7s and offer "Generate PDF report"
    // for a report that was actively being written — a misleading call to
    // action whose one effect is to force a duplicate render. Well past that
    // old mark, and still well inside the server's budget, it must still be
    // waiting.
    await new Promise((resolve) => setTimeout(resolve, 8000))

    expect(screen.queryByRole('button', { name: /generate pdf report/i })).not.toBeInTheDocument()
    expect(screen.getByText(/preparing report/i)).toBeInTheDocument()
  }, 20000)

  it('offers the manual "Generate PDF report" button immediately once the server budget is long gone', async () => {
    // Finished an hour ago with no report: generation did not merely take a
    // while, it did not happen. The manual fallback is the honest state and
    // it is owed *now* — not after another full budget of spinning.
    api.apiGet.mockImplementation(() =>
      Promise.resolve(autoPdfDetail({ end_time: new Date(Date.now() - 3600_000).toISOString() }))
    )

    renderAnalysisDetail('a1')

    expect(
      await screen.findByRole('button', { name: /generate pdf report/i }, { timeout: 2000 })
    ).toBeInTheDocument()
    expect(screen.queryByText(/preparing report/i)).not.toBeInTheDocument()
  }, 10000)

  it('surfaces the manual fallback the moment the server says the report FAILED, without waiting out the budget', async () => {
    // The residual defect the `report_status` field exists for. Aligning the
    // client's patience with the server's 30s budget fixed giving up too
    // EARLY; it left waiting too LONG. A render that dies two seconds in is,
    // to a client with only a clock, indistinguishable from one still going —
    // so the user watched a disabled "Preparing report…" for the remaining
    // twenty-eight seconds of work that was already over.
    //
    // Everything here says "a report is on its way" to the old reasoning:
    // auto_generate_pdf is on and the run finished moments ago. Only the
    // server's own signal says otherwise, and it must be believed at once.
    api.apiGet.mockImplementation(() => Promise.resolve(autoPdfDetail({ report_status: 'failed' })))

    renderAnalysisDetail('a1')

    // Two seconds, against a 30s budget: this can only pass by reading the
    // signal, never by waiting the budget out.
    expect(
      await screen.findByRole('button', { name: /generate pdf report/i }, { timeout: 2000 })
    ).toBeInTheDocument()
    expect(screen.queryByText(/preparing report/i)).not.toBeInTheDocument()
  }, 10000)

  it('believes the server over the snapshot: "skipped" offers the manual button even though the run asked for a PDF', async () => {
    // `settings_snapshot.auto_generate_pdf` records what was *requested*;
    // `report_status` records what actually happened. When they disagree the
    // outcome wins — inferring "a PDF must be coming" from the request is the
    // guess this field replaces.
    api.apiGet.mockImplementation(() => Promise.resolve(autoPdfDetail({ report_status: 'skipped' })))

    renderAnalysisDetail('a1')

    expect(
      await screen.findByRole('button', { name: /generate pdf report/i }, { timeout: 2000 })
    ).toBeInTheDocument()
    expect(screen.queryByText(/preparing report/i)).not.toBeInTheDocument()
  }, 10000)

  it('shows "Preparing report…" when the server says it is generating one the snapshot never asked for', async () => {
    // The mirror image: auto-PDF was off for this run, so the old reasoning
    // offers "Generate PDF report" — a call to action for a render that is
    // already in flight (a manual generation started from another tab, or by
    // this user a moment ago), whose one effect is to duplicate it. The
    // server says it is working; that is not something a client can infer.
    api.apiGet.mockImplementation(() =>
      Promise.resolve(autoPdfDetail({ settings_snapshot: { auto_generate_pdf: false }, report_status: 'generating' }))
    )

    renderAnalysisDetail('a1')

    expect(await screen.findByText(/preparing report/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /generate pdf report/i })).not.toBeInTheDocument()
  }, 10000)

  it('keeps polling through a failed refetch instead of stranding the user on "Preparing report…"', async () => {
    let calls = 0
    api.apiGet.mockImplementation(() => {
      calls += 1
      // A dropped connection mid-wait. The previous loop hung its next
      // attempt off `detail` changing identity, and a rejection leaves
      // `detail` untouched — so the chain died silently right here and the
      // hero sat on "Preparing report…" forever, manual fallback included.
      if (calls === 3) return Promise.reject(new Error('network'))
      if (calls <= 4) return Promise.resolve(autoPdfDetail())
      return Promise.resolve(autoPdfDetail({ report: { report_id: 'r1', generated_at: '2026-01-01T00:05:30Z' } }))
    })

    renderAnalysisDetail('a1')

    expect(await screen.findByText(/preparing report/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /download pdf/i }, { timeout: 8000 })).toBeInTheDocument()
  }, 15000)
})

function preloadedAnalysisState(overrides = {}) {
  return {
    settings: { model: 'yolov8-2.3', frameSampling: 'every5', sensitivity: 68, autoPdf: true, plateRedaction: true, nightMode: false },
    current: null,
    detail: { byId: {}, status: 'idle', error: null },
    polling: {},
    pollErrors: {},
    ...overrides,
  }
}

describe('AnalysisIndexView polling (D4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('actually polls every job tracked in `polling`, not just ones started in this SPA session', async () => {
    // A job some OTHER view (e.g. UploadPage's multi-file start) put into
    // `analysis.polling` — the index view used to have no poller at all for
    // this, so its status/progress/badge count went stale forever.
    api.apiGet.mockImplementation((path) => {
      if (path === '/api/status/j1') {
        return Promise.resolve({ job_id: 'j1', analysis_id: 'j1', status: 'running', progress: 20, stage: 'segmenting frames' })
      }
      return Promise.resolve({ count: 0, page: 1, pages: 1, page_size: 20, results: [] })
    })

    renderAnalysisIndex({
      analysis: preloadedAnalysisState({
        polling: { j1: { job_id: 'j1', analysis_id: 'j1', status: 'running', progress: 5, stage: 'queued' } },
      }),
    })

    await waitFor(() => expect(api.apiGet).toHaveBeenCalledWith('/api/status/j1'))
    expect(await screen.findByText(/segmenting frames/i)).toBeInTheDocument()
  })
})

describe('AnalysisDetailView recoverable connection state (D2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a recoverable "connection problem" banner (not the terminal Analysis failed panel) once poll failures cross the threshold, and Retry clears it', async () => {
    api.apiGet.mockResolvedValue(runningDetail)

    const { store } = renderAnalysisDetail('a1')
    await screen.findByRole('progressbar')

    // Simulate the poll having accumulated enough consecutive transport
    // failures to cross POLL_FAILURE_THRESHOLD (3) — exactly what
    // `pollStatus.rejected` writes into `state.analysis.pollErrors`.
    store.dispatch({
      type: 'analysis/pollStatus/rejected',
      payload: { job_id: 'a1', detail: 'Network error', code: null, status: 0 },
      meta: { arg: 'a1' },
    })
    store.dispatch({
      type: 'analysis/pollStatus/rejected',
      payload: { job_id: 'a1', detail: 'Network error', code: null, status: 0 },
      meta: { arg: 'a1' },
    })
    store.dispatch({
      type: 'analysis/pollStatus/rejected',
      payload: { job_id: 'a1', detail: 'Network error', code: null, status: 0 },
      meta: { arg: 'a1' },
    })

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent(/losing the connection/i)
    // Must never look like the terminal failure panel.
    expect(screen.queryByText(/^analysis failed$/i)).not.toBeInTheDocument()
    // The progress UI (this is still "running" as far as the pipeline goes)
    // must stay visible alongside the banner.
    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(store.getState().analysis.pollErrors.a1).toBeUndefined()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
