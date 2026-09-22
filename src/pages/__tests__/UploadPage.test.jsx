import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import UploadPage from '../UploadPage'
import analysisReducer from '../../features/analysis/analysisSlice'
import uploadReducer from '../../features/upload/uploadSlice'
import settingsReducer from '../../features/settings/settingsSlice'
import uiReducer from '../../features/ui/uiSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    // Never resolves — these tests don't care about the real upload
    // lifecycle, only about what gets queued client-side.
    apiUpload: vi.fn(() => new Promise(() => {})),
  }
})

function renderUploadPage(preloadedState = {}) {
  const store = configureStore({
    reducer: {
      analysis: analysisReducer,
      upload: uploadReducer,
      settings: settingsReducer,
      ui: uiReducer,
    },
    preloadedState,
  })
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/upload']}>
        <UploadPage />
      </MemoryRouter>
    </Provider>
  )
  return { store, ...utils }
}

function makeFile(name, sizeBytes, type = 'video/mp4') {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.apiGet.mockResolvedValue({
      allowed_image_formats: ['jpg', 'png'],
      allowed_video_formats: ['mp4'],
      max_upload_mb: 512,
    })
  })

  it('surfaces a same-selection name+size collision as an explicit rejected row and a toast, instead of silently discarding it (D23)', async () => {
    const { store } = renderUploadPage()

    const input = document.querySelector('input[type="file"]')
    // Two different cameras' clips that happen to share a name and byte
    // size — exactly the false-positive collision D23 describes.
    const fileA = makeFile('clip.mp4', 1024)
    const fileB = makeFile('clip.mp4', 1024)

    fireEvent.change(input, { target: { files: [fileA, fileB] } })

    // Both rows exist — the second file was never silently dropped.
    const rows = await screen.findAllByText('clip.mp4')
    expect(rows).toHaveLength(2)
    expect(
      await screen.findByText(/duplicate — a file with this name and size is already in the queue/i)
    ).toBeInTheDocument()

    // And it's surfaced loudly (a toast), not just a quiet queue row.
    await waitFor(() =>
      expect(
        store.getState().ui.toasts.some((t) => /skipped "clip\.mp4"/i.test(t.message))
      ).toBe(true)
    )
  })

  it('shows a conservative-limit banner (not the old optimistic default) when settings failed to load (D23)', async () => {
    // UploadPage dispatches its own `fetchSettings()` on mount — mock that
    // call itself failing, rather than relying on stale preloaded state,
    // which the mount-time dispatch would immediately overwrite anyway.
    api.apiGet.mockReset()
    api.apiGet.mockRejectedValue(new Error('Network error'))

    renderUploadPage()

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent(/upload limits could not be loaded/i)
    expect(banner).toHaveTextContent('512 MB')
    expect(document.body.textContent).not.toMatch(/2 GB/)
  })

  it('does not offer a fake multi-model choice, and drops the two toggles that do nothing (D27)', async () => {
    renderUploadPage()

    await screen.findByText('Analysis settings')

    // The old <Select aria-label="Detection model"> (Radix renders
    // role="combobox") implied three real choices; only one model ever
    // actually ran server-side.
    expect(screen.queryByRole('combobox', { name: /detection model/i })).not.toBeInTheDocument()
    expect(screen.getByText('YOLO11n')).toBeInTheDocument()

    expect(screen.getByLabelText('Auto-generate PDF report')).toBeInTheDocument()
    expect(screen.queryByLabelText(/license plate redaction/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/night-mode enhancement/i)).not.toBeInTheDocument()
  })

  it('labels the sensitivity slider "Low" at the 0 end and "Strict" at the 100 end, agreeing with the ascending confidence-threshold mapping (shared decision)', async () => {
    renderUploadPage()

    await screen.findByText('Analysis settings')

    const slider = screen.getByRole('slider', { name: /smoke sensitivity/i })
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '100')

    // Left-to-right DOM order of the three track labels must be Low, then
    // Balanced, then Strict — "Low" (0, loosest) must never end up on the
    // high/strict end again (that's the exact D9/shared-decision defect).
    const labels = screen.getAllByText(/^(Low|Balanced|Strict)$/)
    expect(labels.map((l) => l.textContent)).toEqual(['Low', 'Balanced', 'Strict'])

    expect(screen.getByText(/stricter requires higher-confidence/i)).toBeInTheDocument()
  })
})
