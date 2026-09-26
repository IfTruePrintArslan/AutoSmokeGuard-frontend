import { createPortal } from 'react-dom'
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap'

// Hand-rolled focus-trapping confirm dialog — no Radix Dialog is installed,
// so this implements the minimum accessible modal contract itself (via the
// shared `useModalFocusTrap` hook): Esc to close, Tab/Shift+Tab wrap inside
// the dialog even while its controls are disabled, focus restored on close.
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
  const dialogRef = useModalFocusTrap(open, onCancel)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" onClick={busy ? undefined : onCancel} />
      <div
        ref={dialogRef}
        tabIndex={-1}
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
