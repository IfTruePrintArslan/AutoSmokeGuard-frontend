import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '../layout/Sidebar'
import authReducer from '../../features/auth/authSlice'
import uiReducer from '../../features/ui/uiSlice'
import analysisReducer from '../../features/analysis/analysisSlice'

// Minimal `window.matchMedia` mock so `useMediaQuery` can read/report a
// given viewport-width bucket without a real browser layout engine. Only
// the `(max-width: 768px)` query used by Sidebar needs to resolve here.
function mockMatchMedia(matchesFor) {
  const listeners = new Set()
  window.matchMedia = (query) => ({
    query,
    matches: matchesFor(query),
    media: query,
    addEventListener: (_, cb) => listeners.add(cb),
    removeEventListener: (_, cb) => listeners.delete(cb),
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
  })
}

function renderSidebar({ mobileNavOpen = false } = {}) {
  const store = configureStore({
    reducer: { auth: authReducer, ui: uiReducer, analysis: analysisReducer },
    preloadedState: {
      ui: { sidebarOpen: true, mobileNavOpen, sidebarCollapsed: false, toasts: [] },
    },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar />
      </MemoryRouter>
    </Provider>
  )
}

describe('Sidebar — off-canvas drawer tab order (D26)', () => {
  afterEach(() => {
    delete window.matchMedia
  })

  it('makes the closed drawer inert and aria-hidden on a narrow (drawer-mode) viewport', () => {
    mockMatchMedia(() => true) // simulate <769px
    const { container } = renderSidebar({ mobileNavOpen: false })

    const aside = container.querySelector('aside')
    expect(aside).toHaveAttribute('aria-hidden', 'true')
    // jsdom doesn't reflect the `inert` IDL property, but it does reflect
    // the content attribute React renders it as — assert on that directly.
    expect(aside.hasAttribute('inert')).toBe(true)

    // Its links must not be reachable via Tab while hidden off-screen.
    const signOut = aside.querySelector('button[aria-label="Sign out"]')
    expect(signOut).not.toBeNull()
    expect(signOut.closest('[inert]')).not.toBeNull()
  })

  it('is interactive (not inert) once the drawer is opened, still on a narrow viewport', () => {
    mockMatchMedia(() => true) // simulate <769px
    const { container } = renderSidebar({ mobileNavOpen: true })

    const aside = container.querySelector('aside')
    expect(aside.hasAttribute('inert')).toBe(false)
    expect(aside).not.toHaveAttribute('aria-hidden', 'true')
  })

  it('never inerts the always-visible desktop rail, even though mobileNavOpen defaults to false', () => {
    mockMatchMedia(() => false) // simulate >=769px desktop
    const { container } = renderSidebar({ mobileNavOpen: false })

    const aside = container.querySelector('aside')
    expect(aside.hasAttribute('inert')).toBe(false)
    expect(aside).not.toHaveAttribute('aria-hidden', 'true')
  })
})
