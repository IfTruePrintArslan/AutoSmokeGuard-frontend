import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import Topbar from '../layout/Topbar'
import uiReducer from '../../features/ui/uiSlice'
import * as api from '../../lib/api'

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api')
  return { ...actual, apiGet: vi.fn() }
})

function renderTopbar() {
  const store = configureStore({ reducer: { ui: uiReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Topbar />
      </MemoryRouter>
    </Provider>
  )
}

describe('Topbar — command palette focus management (D21)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.apiGet.mockResolvedValue({ results: [] })
  })

  it('has no notification bell (dead control removed, D27)', () => {
    renderTopbar()
    expect(screen.queryByRole('button', { name: /notification/i })).not.toBeInTheDocument()
  })

  it('moves focus into the palette on open, traps Tab, and restores focus to the trigger on close', async () => {
    renderTopbar()

    const openBtn = screen.getByRole('button', { name: 'Open search' })
    openBtn.focus()
    expect(document.activeElement).toBe(openBtn)

    fireEvent.click(openBtn)
    const dialog = await screen.findByRole('dialog', { name: /search analyses/i })
    const searchInput = screen.getByRole('textbox', { name: /search analyses by filename/i })

    // Focus moves to the search input (the palette's first focusable
    // control) on open — not left behind on the trigger under the overlay.
    expect(document.activeElement).toBe(searchInput)

    // Tab containment: with nothing else focusable (no results yet), Tab
    // must not be allowed to escape the dialog to the page behind it.
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(dialog.contains(document.activeElement)).toBe(true)

    // Escape closes it and restores focus to the trigger button.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /search analyses/i })).not.toBeInTheDocument()
    expect(document.activeElement).toBe(openBtn)
  })
})
