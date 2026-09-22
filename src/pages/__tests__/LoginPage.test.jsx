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
    const { container } = renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(container.querySelector('#login-password'), 'secret123')
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
    const { container } = renderLoginPage()

    await user.type(screen.getByLabelText('Email'), 'hamza@transport.gov.pk')
    await user.type(container.querySelector('#login-password'), 'wrongpass1')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument()
  })
})
