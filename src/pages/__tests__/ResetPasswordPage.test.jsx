import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import ResetPasswordPage from '../ResetPasswordPage'
import authReducer from '../../features/auth/authSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn() }
})

function renderResetPasswordPage(initialEntry = '/reset-password?token=abc123') {
  const store = configureStore({ reducer: { auth: authReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </Provider>
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('announces the missing-token banner via role="alert" (D22)', () => {
    renderResetPasswordPage('/reset-password')

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/missing a reset token/i)
  })

  it('announces a client-side validation error via role="alert" wired to aria-describedby (D22)', async () => {
    const user = userEvent.setup()
    renderResetPasswordPage()

    await user.type(screen.getByLabelText('New password'), 'short1')
    await user.type(screen.getByLabelText('Confirm new password'), 'short1')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/at least 8 characters/i)
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-describedby', alert.id)
    expect(api.apiPost).not.toHaveBeenCalled()
  })

  it('announces a rejected reset request via role="alert" (D22)', async () => {
    api.apiPost.mockRejectedValueOnce(
      new api.ApiError({
        status: 400,
        code: 'invalid_token',
        detail: 'This reset link is invalid or has expired.',
        errors: {},
      })
    )
    const user = userEvent.setup()
    renderResetPasswordPage()

    await user.type(screen.getByLabelText('New password'), 'Passw0rd123')
    await user.type(screen.getByLabelText('Confirm new password'), 'Passw0rd123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/invalid or has expired/i)
  })
})
