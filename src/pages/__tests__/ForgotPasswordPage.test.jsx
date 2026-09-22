import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import ForgotPasswordPage from '../ForgotPasswordPage'
import authReducer from '../../features/auth/authSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn() }
})

function renderForgotPasswordPage() {
  const store = configureStore({ reducer: { auth: authReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    </Provider>
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('announces an invalid-email error via role="alert" wired to aria-describedby (D22)', async () => {
    const user = userEvent.setup()
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/enter a valid email address/i)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', alert.id)
    expect(api.apiPost).not.toHaveBeenCalled()
  })

  it('announces a rejected request via role="alert" (D22)', async () => {
    api.apiPost.mockRejectedValueOnce(
      new api.ApiError({
        status: 429,
        code: 'throttled',
        detail: 'Request was throttled. Expected available in 43 seconds.',
      })
    )
    const user = userEvent.setup()
    renderForgotPasswordPage()

    await user.type(screen.getByLabelText('Email'), 'hamza@transport.gov.pk')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/too many requests/i)
  })
})
