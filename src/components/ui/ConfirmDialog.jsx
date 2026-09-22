import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Hand-rolled focus-trapping confirm dialog — no Radix Dialog is installed,
// so this implements the minimum accessible modal contract itself: Esc to
// close, Tab/Shift+Tab wrap inside the dialog, focus restored on close.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current = document.activeElement

    function getFocusable() {
      return dialogRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    }
    getFocusable()?.[0]?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel?.()
        return
      }
      if (e.key === 'Tab') {
        const focusable = getFocusable()
        if (!focusable || !focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (previouslyFocused.current?.focus) previouslyFocused.current.focus()
    }
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={busy ? undefined : onCancel} />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-desc' : undefined}
        className="relative card w-full max-w-[400px] p-5"
      >
        <h2 id="confirm-dialog-title" className="text-[15px] font-semibold">{title}</h2>
        {description && (
          <p id="confirm-dialog-desc" className="text-[12.5px] text-text-2 mt-2 leading-relaxed">
            {description}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? 'btn bg-high text-[#2b0a0a]' : 'btn btn-pri'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
