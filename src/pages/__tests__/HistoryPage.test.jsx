import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import HistoryPage from '../HistoryPage'
import historyReducer from '../../features/history/historySlice'
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

function renderHistoryPage() {
  const store = configureStore({ reducer: { history: historyReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/history']}>
        <HistoryPage />
      </MemoryRouter>
    </Provider>
  )
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

  it('shows the empty state when count is 0', async () => {
    api.apiGet.mockResolvedValueOnce({ count: 0, page: 1, pages: 1, page_size: 10, results: [] })

    renderHistoryPage()

    expect(await screen.findByText(/no analyses yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload media/i })).toBeInTheDocument()
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
})
