import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'
import authReducer from '../../features/auth/authSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
  }
})

function renderLoginPage() {
  const store = configureStore({ reducer: { auth: authReducer } })
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </Provider>
  )
  return { store, ...utils }
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the sign-in form', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('blocks submission with an invalid email', async () => {
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument()
    expect(api.apiPost).not.toHaveBeenCalled()
  })

  it('renders a server field error when the login request is rejected', async () => {
    api.apiPost.mockRejectedValueOnce(
      new api.ApiError({
        status: 401,
        code: 'invalid_credentials',
        detail: 'Invalid credentials.',
        errors: { password: ['Incorrect password.'] },
      })
    )
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'hamza@transport.gov.pk')
    await user.type(screen.getByLabelText('Password'), 'wrongpass1')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument()
  })

  it('maps a 429 throttled rejection to a friendly message instead of leaking DRF wording', async () => {
    api.apiPost.mockRejectedValueOnce(
      new api.ApiError({
        status: 429,
        code: 'throttled',
        detail: 'Request was throttled. Expected available in 43 seconds.',
      })
    )
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'hamza@transport.gov.pk')
    await user.type(screen.getByLabelText('Password'), 'Passw0rd123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/too many sign-in attempts/i)).toBeInTheDocument()
    // The raw DRF string must never reach the page.
    expect(screen.queryByText(/expected available in/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^request was throttled/i)).not.toBeInTheDocument()
  })

  it('gives the password field the accessible name "Password" alone (not "Password Forgot password?"), and announces errors (D22)', async () => {
    api.apiPost.mockRejectedValueOnce(
      new api.ApiError({
        status: 401,
        code: 'invalid_credentials',
        detail: 'Invalid credentials.',
        errors: { password: ['Incorrect password.'] },
      })
    )
    const user = userEvent.setup()
    renderLoginPage()

    // The "Forgot password?" link must not leak into the field's accessible
    // name — this is exactly why the old test needed a raw CSS selector.
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument()
    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'hamza@transport.gov.pk')
    await user.type(passwordInput, 'wrongpass1')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/incorrect password/i)
    expect(passwordInput).toHaveAttribute('aria-describedby', alert.id)
  })

  it('has no "Continue with Google" button (dead control removed, D27)', () => {
    renderLoginPage()
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
  })
})
