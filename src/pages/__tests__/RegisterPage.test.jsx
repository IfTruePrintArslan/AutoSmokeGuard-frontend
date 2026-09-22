import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from '../RegisterPage'
import authReducer from '../../features/auth/authSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn() }
})

function renderRegisterPage() {
  const store = configureStore({ reducer: { auth: authReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    </Provider>
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('has no "Continue with Google" button (dead control removed, D27)', () => {
    renderRegisterPage()
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
  })

  it('announces a server field error via role="alert" wired to aria-describedby (D22)', async () => {
    api.apiPost.mockRejectedValueOnce(
      new api.ApiError({
        status: 400,
        code: 'validation_error',
        detail: 'Validation failed.',
        errors: { full_name: ['This field is required.'] },
      })
    )
    const user = userEvent.setup()
    renderRegisterPage()

    // A valid name so client-side validation passes and the request
    // actually reaches the (mocked) server, whose `full_name` field error
    // this form maps back onto the "Name" input.
    await user.type(screen.getByLabelText('Name'), 'Someone Valid')
    await user.type(screen.getByLabelText('Email'), 'newperson@transport.gov.pk')
    await user.type(screen.getByLabelText('Password'), 'Passw0rd123')
    await user.type(screen.getByLabelText('Confirm password'), 'Passw0rd123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/this field is required/i)
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', alert.id)
  })

  it('announces a client-side validation error (weak password) via role="alert" (D22)', async () => {
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByLabelText('Name'), 'Weak Password')
    await user.type(screen.getByLabelText('Email'), 'weak@transport.gov.pk')
    await user.type(screen.getByLabelText('Password'), 'short1')
    await user.type(screen.getByLabelText('Confirm password'), 'short1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/at least 8 characters/i)
    expect(api.apiPost).not.toHaveBeenCalled()
  })
})
