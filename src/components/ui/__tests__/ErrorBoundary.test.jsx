import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, Outlet, Link } from 'react-router-dom'
import ErrorBoundary from '../ErrorBoundary'

// D5 — a render-time throw with no boundary above it unmounts the ENTIRE
// React tree, so one bad value (a string where a number was expected, e.g.
// `model_metrics.dice` copied unvalidated out of metrics.json) white-screens
// every route, not just the page that touched it.

function Boom({ value }) {
  // Exactly the SettingsPage shape: optional chaining guards null, not a
  // wrong type.
  return <div>{value?.toFixed(2)}</div>
}

function Shell() {
  return (
    <div>
      <nav>
        <Link to="/settings">Settings</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
      <Outlet />
    </div>
  )
}

describe('ErrorBoundary (D5)', () => {
  let consoleError

  beforeEach(() => {
    // React logs the caught error itself; keep the suite output readable.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('renders a readable panel instead of unmounting the tree', () => {
    render(
      <ErrorBoundary>
        <Boom value="0.87" />
      </ErrorBoundary>
    )

    const panel = screen.getByRole('alert')
    expect(panel).toBeInTheDocument()
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()
  })

  it('puts the error message in a details block that starts collapsed', async () => {
    render(
      <ErrorBoundary>
        <Boom value="0.87" />
      </ErrorBoundary>
    )

    const details = document.querySelector('details')
    expect(details).not.toBeNull()
    expect(details.open).toBe(false)
    expect(screen.getByText(/error details/i)).toBeInTheDocument()
    expect(details.textContent).toMatch(/toFixed is not a function/i)
  })

  it('offers a Reload action and a link back to the dashboard', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    const original = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })

    render(
      <ErrorBoundary>
        <Boom value="0.87" />
      </ErrorBoundary>
    )

    const back = screen.getByRole('link', { name: /back to dashboard/i })
    expect(back).toHaveAttribute('href', '/dashboard')

    await user.click(screen.getByRole('button', { name: /reload/i }))
    expect(reload).toHaveBeenCalledTimes(1)

    if (original) Object.defineProperty(window, 'location', original)
  })

  it('renders children untouched when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom value={0.87} />
      </ErrorBoundary>
    )

    expect(screen.getByText('0.87')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the surrounding shell alive and recovers when the route changes', async () => {
    const user = userEvent.setup()

    // Mirrors the App.jsx wiring: AppLayout -> boundary -> page, so a page
    // crash leaves the nav usable.
    function Boundary() {
      return (
        <ErrorBoundary resetKey="/settings">
          <Outlet />
        </ErrorBoundary>
      )
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route element={<Shell />}>
            <Route element={<Boundary />}>
              <Route path="/settings" element={<Boom value="0.87" />} />
              <Route path="/dashboard" element={<div>Dashboard content</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // The page blew up, but the shell's navigation is still there.
    expect(screen.getByRole('alert')).toBeInTheDocument()
    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
    expect(dashboardLink).toBeInTheDocument()

    await user.click(dashboardLink)

    // The boundary is keyed on the route, so navigating away clears it
    // rather than pinning the panel to every subsequent page.
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<Shell />}>
            <Route
              element={
                <ErrorBoundary resetKey="/dashboard">
                  <Outlet />
                </ErrorBoundary>
              }
            >
              <Route path="/settings" element={<Boom value="0.87" />} />
              <Route path="/dashboard" element={<div>Dashboard content</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears a caught error when resetKey changes', () => {
    function Harness({ routeKey, throws }) {
      return (
        <ErrorBoundary resetKey={routeKey}>
          <Boom value={throws ? '0.87' : 0.87} />
        </ErrorBoundary>
      )
    }

    const { rerender } = render(<Harness routeKey="/settings" throws />)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(<Harness routeKey="/dashboard" throws={false} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('0.87')).toBeInTheDocument()
  })
})
