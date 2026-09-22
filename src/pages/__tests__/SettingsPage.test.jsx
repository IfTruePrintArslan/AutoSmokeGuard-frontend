import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </Provider>
  )
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
})
