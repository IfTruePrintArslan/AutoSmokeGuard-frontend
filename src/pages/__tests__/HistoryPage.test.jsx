import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import HistoryPage from '../HistoryPage'
import historyReducer, { setPage } from '../../features/history/historySlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiDelete: vi.fn(),
    apiDownload: vi.fn(),
  }
})

function renderHistoryPage(initialEntry = '/history', preloadedState) {
  const store = configureStore({ reducer: { history: historyReducer }, preloadedState })
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HistoryPage />
      </MemoryRouter>
    </Provider>
  )
  return { store, ...utils }
}

const paginatedRow = {
  analysis_id: 'a1',
  media: { media_id: 'm1', filename: 'clip.mp4', media_type: 'video', url: '/media/x.mp4' },
  status: 'done',
  progress: 100,
  created_at: '2026-01-01T00:00:00Z',
  start_time: '2026-01-01T00:00:00Z',
  end_time: '2026-01-01T00:05:00Z',
  duration_seconds: 8.4,
  total_vehicles: 3,
  total_smoke: 1,
  avg_confidence: 0.9,
  overall_severity: 'high',
  severity_counts: { low: 0, moderate: 0, high: 1 },
  preview_url: null,
  report: null,
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders rows from a mocked paginated response', async () => {
    api.apiGet.mockResolvedValueOnce({
      count: 1,
      page: 1,
      pages: 1,
      page_size: 10,
      results: [paginatedRow],
    })

    renderHistoryPage()

    expect(await screen.findByText('clip.mp4')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('labels the count column "Vehicle detections" (not "Vehicles") and explains it via a tooltip', async () => {
    api.apiGet.mockResolvedValueOnce({
      count: 1,
      page: 1,
      pages: 1,
      page_size: 10,
      results: [paginatedRow],
    })

    renderHistoryPage()

    expect(await screen.findByText('Vehicle detections')).toBeInTheDocument()
    expect(screen.queryByText('Vehicles', { selector: 'th' })).not.toBeInTheDocument()

    const tooltipTrigger = screen.getByRole('button', { name: /what does "vehicle detections" mean/i })
    expect(tooltipTrigger).toHaveAttribute('aria-describedby')
    const tooltipId = tooltipTrigger.getAttribute('aria-describedby')
    expect(document.getElementById(tooltipId)).toHaveTextContent(/detections across sampled frames, not unique vehicles/i)
  })

  it('shows the empty state when count is 0', async () => {
    api.apiGet.mockResolvedValueOnce({ count: 0, page: 1, pages: 1, page_size: 10, results: [] })

    renderHistoryPage()

    expect(await screen.findByText(/no analyses yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload media/i })).toBeInTheDocument()
  })

  it('hydrates filters, page, and page size from the URL on mount (D30)', async () => {
    // The only pre-existing filter test mounted at plain `/history` — the
    // URL-hydration effect (`didHydrateRef`) never actually ran under that,
    // so a regression there would not have been caught. Hydrating three
    // separate pieces of state (filters, page, pageSize) can trigger more
    // than one fetch as each lands, so every call gets a resolved value.
    api.apiGet.mockResolvedValue({ count: 0, page: 2, pages: 3, page_size: 5, results: [] })

    renderHistoryPage('/history?search=traffic&severity=high&page=2&page_size=5')

    await waitFor(() => expect(api.apiGet).toHaveBeenCalled())
    const [calledPath] = api.apiGet.mock.calls[api.apiGet.mock.calls.length - 1]
    expect(calledPath).toContain('search=traffic')
    expect(calledPath).toContain('severity=high')
    expect(calledPath).toContain('page=2')
    expect(calledPath).toContain('page_size=5')

    // The search box must reflect the hydrated value too — proof this came
    // from the URL, not just the (empty) default filter state.
    expect(screen.getByLabelText('Search')).toHaveValue('traffic')
  })

  it('refetches when a filter (debounced search) changes', async () => {
    api.apiGet.mockResolvedValue({ count: 0, page: 1, pages: 1, page_size: 10, results: [] })
    const user = userEvent.setup()

    renderHistoryPage()

    await waitFor(() => expect(api.apiGet).toHaveBeenCalledTimes(1))

    await user.type(screen.getByLabelText('Search'), 'traffic')

    await waitFor(() => expect(api.apiGet).toHaveBeenCalledTimes(2), { timeout: 2000 })
    expect(api.apiGet.mock.calls[1][0]).toContain('search=traffic')
  })

  it('clamps to the last known-good page when the current page goes out of range (D13)', async () => {
    api.apiGet.mockResolvedValueOnce({ count: 1, page: 1, pages: 2, page_size: 10, results: [paginatedRow] })

    const { store } = renderHistoryPage()
    await screen.findByText('clip.mp4')

    // The only row on page 2 was just deleted elsewhere — the server now
    // 404s that page (DRF's `NotFound` for an out-of-range page).
    api.apiGet.mockRejectedValueOnce(
      new api.ApiError({ status: 404, code: 'not_found', detail: 'Invalid page.' })
    )
    api.apiGet.mockResolvedValueOnce({ count: 1, page: 1, pages: 1, page_size: 10, results: [paginatedRow] })

    store.dispatch(setPage(2))

    // Clamped back to the last known-good page automatically...
    await waitFor(() => expect(store.getState().history.page).toBe(1))
    // ...the row set recovers...
    expect(await screen.findByText('clip.mp4')).toBeInTheDocument()
    // ...and the red ErrorState never flashes for what is a clamp, not a
    // real failure.
    expect(screen.queryByText(/failed to load history/i)).not.toBeInTheDocument()
  })
})
