import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../DashboardPage'
import authReducer from '../../features/auth/authSlice'
import dashboardReducer from '../../features/dashboard/dashboardSlice'
import uploadReducer from '../../features/upload/uploadSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

function baseStats(overrides = {}) {
  return {
    totals: {
      analyses: 12, high_severity: 2, reports: 8, avg_confidence: 0.87,
      analyses_delta_pct: 5, high_delta_pct: -1, reports_delta_pct: 3, confidence_delta_pct: 0.5,
    },
    sparklines: { analyses: [1, 2, 3], high: [0, 1, 0], reports: [1, 1, 2], confidence: [0.8, 0.85, 0.9] },
    detections_over_time: [],
    severity_distribution: [
      { key: 'low', label: 'Low', value: 5, pct: 42, color: '#4ade80' },
      { key: 'moderate', label: 'Moderate', value: 4, pct: 33, color: '#fbbf24' },
      { key: 'high', label: 'High', value: 3, pct: 25, color: '#f87171' },
    ],
    recent_analyses: [
      {
        analysis_id: 'a1',
        media: { media_id: 'm1', filename: 'clip.mp4', media_type: 'video', url: '/x' },
        status: 'done', progress: 100, total_vehicles: 4, avg_confidence: 0.9, overall_severity: 'high',
      },
    ],
    processing_queue: [],
    ...overrides,
  }
}

function day(dateSuffix, detections, high = 0) {
  return { date: `2026-02-${dateSuffix}`, label: `Feb ${dateSuffix}`, detections, high }
}

function renderDashboard() {
  const store = configureStore({
    reducer: { auth: authReducer, dashboard: dashboardReducer, upload: uploadReducer },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>
    </Provider>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('labels the recent-analyses count "Vehicle detections" with an explanatory tooltip', async () => {
    api.apiGet.mockResolvedValue(baseStats({
      detections_over_time: Array.from({ length: 5 }, (_, i) => day(String(10 + i).padStart(2, '0'), i + 1)),
    }))

    renderDashboard()

    expect(await screen.findByText('Vehicle detections')).toBeInTheDocument()
    expect(screen.queryByText('Vehicles', { selector: 'th' })).not.toBeInTheDocument()

    const tooltipTrigger = screen.getByRole('button', { name: /what does "vehicle detections" mean/i })
    expect(tooltipTrigger).toHaveAttribute('aria-describedby')
  })

  it('puts the filename under "Source" and only the count under "Vehicle detections" (D9)', async () => {
    api.apiGet.mockResolvedValue(baseStats())

    renderDashboard()

    const table = await screen.findByRole('table')
    const headerCells = within(table).getAllByRole('columnheader')
    expect(headerCells).toHaveLength(5)
    expect(headerCells[0]).toHaveTextContent('Source')
    expect(headerCells[1]).toHaveTextContent('Vehicle detections')
    expect(headerCells[2]).toHaveTextContent('Confidence')
    expect(headerCells[3]).toHaveTextContent('Severity')

    const rows = within(table).getAllByRole('row')
    const bodyCells = within(rows[1]).getAllByRole('cell')
    // Source (first column) carries the thumbnail + filename.
    expect(bodyCells[0]).toHaveTextContent('clip.mp4')
    // Vehicle detections (second column) carries only the numeric count —
    // never the filename, and never blank.
    expect(bodyCells[1]).toHaveTextContent('4')
    expect(bodyCells[1]).not.toHaveTextContent('clip.mp4')
  })

  it('renders a healthy multi-day series as the normal trend chart, with no sparse-history notice', async () => {
    api.apiGet.mockResolvedValue(baseStats({
      detections_over_time: Array.from({ length: 10 }, (_, i) => day(String(10 + i).padStart(2, '0'), i + 1)),
    }))

    renderDashboard()

    await screen.findByText('Detections over time')
    expect(screen.queryByText(/not enough history yet/i)).not.toBeInTheDocument()
  })

  it('treats a brand-new account\'s single active day as sparse — an honest notice instead of a flat line + hairline spike', async () => {
    const series = [
      ...Array.from({ length: 13 }, (_, i) => day(String(i + 1).padStart(2, '0'), 0)),
      day('14', 9, 3),
    ]
    api.apiGet.mockResolvedValue(baseStats({ detections_over_time: series }))

    renderDashboard()

    const notice = await screen.findByText(/not enough history yet/i)
    // The real figures are surfaced (not hidden, not fabricated) — the
    // actual count and the actual day they happened on are both named.
    const noticeContainer = notice.closest('div')
    expect(noticeContainer).toHaveTextContent('9')
    expect(noticeContainer).toHaveTextContent('Feb 14')
  })

  it('does not show a sparse-history notice when the series is entirely empty (nothing to annotate)', async () => {
    api.apiGet.mockResolvedValue(baseStats({
      detections_over_time: Array.from({ length: 14 }, (_, i) => day(String(i + 1).padStart(2, '0'), 0)),
    }))

    renderDashboard()

    await screen.findByText('Detections over time')
    expect(screen.getByText(/no detections in this range/i)).toBeInTheDocument()
    expect(screen.queryByText(/not enough history yet/i)).not.toBeInTheDocument()
  })
})
