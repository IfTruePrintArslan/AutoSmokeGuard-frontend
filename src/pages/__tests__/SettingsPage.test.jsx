import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../SettingsPage'
import authReducer from '../../features/auth/authSlice'
import settingsReducer from '../../features/settings/settingsSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPatch: vi.fn(),
  }
})

const settingsPayload = {
  allowed_image_formats: ['jpg', 'png'],
  allowed_video_formats: ['mp4'],
  max_upload_mb: 512,
  confidence_threshold: 0.35,
  smoke_mask_threshold: 0.5,
  severity_low_max: 0.33,
  severity_moderate_max: 0.66,
  frame_sample_rate: 5,
  auto_generate_pdf: true,
  max_video_seconds: 300,
  updated_at: '2026-01-01T00:00:00Z',
  updated_by: null,
  runtime: null,
}

function renderSettingsPage(role) {
  const store = configureStore({
    reducer: { auth: authReducer, settings: settingsReducer },
    preloadedState: {
      auth: {
        user: {
          user_id: 1,
          email: 'a@b.com',
          full_name: 'A B',
          role,
          created_at: '2025-01-01T00:00:00Z',
        },
        access: 'a',
        refresh: 'r',
        status: 'idle',
        error: null,
        fieldErrors: {},
        bootstrapped: true,
      },
    },
  })
  const utils = render(
    <Provider store={store}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </Provider>
  )
  return { store, ...utils }
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a non-admin sees disabled inputs and no Save button', async () => {
    api.apiGet.mockResolvedValueOnce(settingsPayload)

    renderSettingsPage('user')

    expect(await screen.findByText(/administrator access required/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Max upload size')).toBeDisabled()
    expect(screen.getByLabelText('Frame sample rate')).toBeDisabled()
  })

  it('an admin sees enabled inputs and a Save button', async () => {
    api.apiGet.mockResolvedValueOnce(settingsPayload)

    renderSettingsPage('admin')

    expect(await screen.findByLabelText('Max upload size')).not.toBeDisabled()
    // Save is disabled until the form is dirty, but it is present for admins.
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.queryByText(/administrator access required/i)).not.toBeInTheDocument()
  })

  it('sends only the changed field(s) in the PATCH, not all ten (D14)', async () => {
    api.apiGet.mockResolvedValueOnce(settingsPayload)
    api.apiPatch.mockResolvedValueOnce({ ...settingsPayload, max_upload_mb: 600 })

    renderSettingsPage('admin')

    const input = await screen.findByLabelText('Max upload size')
    fireEvent.change(input, { target: { value: '600' } })

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(api.apiPatch).toHaveBeenCalledTimes(1))
    expect(api.apiPatch).toHaveBeenCalledWith('/api/settings', { max_upload_mb: 600 })
  })

  it('re-syncs the form when a fresh fetch updates the store and there are no local edits (D14)', async () => {
    api.apiGet.mockResolvedValueOnce(settingsPayload)
    const { store } = renderSettingsPage('admin')

    expect(await screen.findByLabelText('Max upload size')).toHaveValue(512)

    // Simulate another page's own fetchSettings landing in the shared store
    // (e.g. visiting /upload right before this page's own fetch resolves) —
    // this page must adopt the fresh value, not discard it.
    await act(async () => {
      store.dispatch({
        type: 'settings/fetchSettings/fulfilled',
        payload: { ...settingsPayload, max_upload_mb: 100 },
      })
    })

    expect(await screen.findByLabelText('Max upload size')).toHaveValue(100)
  })

  it('does not stomp an in-progress edit when the server value changes underneath, and shows an indicator (D14)', async () => {
    api.apiGet.mockResolvedValueOnce(settingsPayload)
    const { store } = renderSettingsPage('admin')

    const frameInput = await screen.findByLabelText('Frame sample rate')
    fireEvent.change(frameInput, { target: { value: '9' } })
    expect(frameInput).toHaveValue(9)

    // Someone else's save updates a DIFFERENT field on the server while this
    // admin is still mid-edit.
    await act(async () => {
      store.dispatch({
        type: 'settings/fetchSettings/fulfilled',
        payload: { ...settingsPayload, max_upload_mb: 100 },
      })
    })

    // The in-progress edit must survive...
    expect(frameInput).toHaveValue(9)
    // ...and the admin must be told the server moved on underneath them.
    expect(await screen.findByRole('alert')).toHaveTextContent(/someone else changed these settings/i)
  })

  it('does not throw when model_metrics comes back with a string value instead of a number', async () => {
    // Exactly the shape a concurrent retrain rewriting metrics.json can
    // produce — optional chaining guards null/undefined, not a wrong type.
    api.apiGet.mockResolvedValueOnce({
      ...settingsPayload,
      runtime: {
        device: 'cpu',
        segmenter_mode: 'unet',
        yolo_weights_present: true,
        segmenter_weights_present: true,
        worker_threads: 4,
        model_metrics: { dice: '0.87', iou: null, pixel_accuracy: 0.91 },
      },
    })

    renderSettingsPage('admin')

    expect(await screen.findByText('Dice')).toBeInTheDocument()
    // A malformed (string) metric must render a safe placeholder, not throw.
    // (StatChip's label div matches `.closest('div')` itself, so go one more
    // level up to the chip's own container to see the value alongside it.)
    const diceChip = screen.getByText('Dice').parentElement
    expect(diceChip).toHaveTextContent('—')
    const iouChip = screen.getByText('IoU').parentElement
    expect(iouChip).toHaveTextContent('—')
    const pixelChip = screen.getByText('Pixel accuracy').parentElement
    expect(pixelChip).toHaveTextContent('0.91')
  })
})
