import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog'

function Harness() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, forceRerender] = useState(0)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open trigger</button>
      <button type="button" onClick={() => forceRerender((t) => t + 1)}>Force re-render</button>
      <button type="button" onClick={() => setBusy((b) => !b)}>Toggle busy</button>
      <ConfirmDialog
        open={open}
        title="Delete this analysis?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={() => {}}
        // A fresh arrow on every render — mirrors HistoryPage's
        // `onCancel={() => setDeleteTarget(null)}` inline identity, which is
        // the exact trigger for the D15 regression.
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}

describe('ConfirmDialog focus management (D15)', () => {
  it('moves focus into the dialog on open and restores it to the trigger on close', async () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open trigger' })
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancelBtn)

    fireEvent.click(cancelBtn)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  it('does not steal focus away from a control the user tabbed to when the parent re-renders with a new onCancel identity', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open trigger' }))

    const deleteBtn = await screen.findByRole('button', { name: 'Delete' })
    deleteBtn.focus()
    expect(document.activeElement).toBe(deleteBtn)

    // Parent re-renders (new inline onCancel arrow) while the dialog stays
    // open — this must NOT yank focus back to the first focusable control.
    fireEvent.click(screen.getByRole('button', { name: 'Force re-render' }))
    expect(document.activeElement).toBe(deleteBtn)
  })

  it('keeps the Tab trap alive even while every control is disabled (busy)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open trigger' }))
    const dialog = await screen.findByRole('alertdialog')

    fireEvent.click(screen.getByRole('button', { name: 'Toggle busy' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /delete|working/i })).toBeDisabled()

    dialog.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(event)

    // With nothing focusable inside, Tab must be swallowed (not left free to
    // escape to the page behind the dialog) and focus kept on the surface.
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(dialog)
  })
})
