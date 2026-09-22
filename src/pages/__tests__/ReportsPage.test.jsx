import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import ReportsPage from '../ReportsPage'
import uiReducer from '../../features/ui/uiSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiDownload: vi.fn(),
  }
})

function renderReportsPage() {
  const store = configureStore({ reducer: { ui: uiReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/reports']}>
        <ReportsPage />
      </MemoryRouter>
    </Provider>
  )
}

// G16 — GET /api/reports rows now carry a slim nested `analysis` (filename,
// severity, vehicle/smoke totals) instead of the bare ReportObj the page
// used to render '—' placeholders for.
const reportRow = {
  report_id: 'r1',
  analysis_id: 'a1',
  generated_at: '2026-01-01T00:05:00Z',
  page_count: 4,
  file_size_bytes: 284113,
  download_url: '/api/download-report/r1',
  analysis: {
    analysis_id: 'a1',
    overall_severity: 'moderate',
    total_vehicles: 7,
    total_smoke: 3,
    media: { media_id: 'm1', filename: 'smoking-truck.mp4', media_type: 'video' },
  },
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the source filename and overall severity from the nested analysis', async () => {
    api.apiGet.mockResolvedValueOnce({
      count: 1, page: 1, pages: 1, page_size: 10, results: [reportRow],
    })

    renderReportsPage()

    expect(await screen.findByText('smoking-truck.mp4')).toBeInTheDocument()
    // "moderate" maps to the "Moderate" label via SeverityBadge/sevLabel.
    expect(screen.getByText('Moderate')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view analysis/i })).toHaveAttribute('href', '/analysis/a1')
  })

  it('shows the SeverityBadge "Unknown" fallback when overall_severity is null', async () => {
    const noSeverityRow = {
      ...reportRow,
      report_id: 'r2',
      analysis: { ...reportRow.analysis, overall_severity: null },
    }
    api.apiGet.mockResolvedValueOnce({
      count: 1, page: 1, pages: 1, page_size: 10, results: [noSeverityRow],
    })

    renderReportsPage()

    expect(await screen.findByText('smoking-truck.mp4')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('shows the empty state when count is 0', async () => {
    api.apiGet.mockResolvedValueOnce({ count: 0, page: 1, pages: 1, page_size: 10, results: [] })

    renderReportsPage()

    expect(await screen.findByText(/no reports yet/i)).toBeInTheDocument()
  })
})
