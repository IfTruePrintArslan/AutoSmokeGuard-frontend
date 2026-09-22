import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { createPortal } from 'react-dom'
import { dismissToast } from '../../features/ui/uiSlice'

const VARIANT_CLASS = {
  success: 'border-low/40',
  error: 'border-high/40',
  info: 'border-line-2',
}

function ToastItem({ toast }) {
  const dispatch = useDispatch()

  useEffect(() => {
    const id = setTimeout(() => dispatch(dismissToast(toast.id)), toast.duration || 4000)
    return () => clearTimeout(id)
  }, [toast.id, toast.duration, dispatch])

  return (
    <div
      role="status"
      className={`card px-4 py-3 text-[13px] text-text shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-3 min-w-[240px] max-w-[380px] ${VARIANT_CLASS[toast.variant] || VARIANT_CLASS.info}`}
    >
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="text-muted hover:text-text bg-transparent border-none cursor-pointer text-[16px] leading-none"
        onClick={() => dispatch(dismissToast(toast.id))}
      >
        ×
      </button>
    </div>
  )
}

export default function Toaster() {
  const toasts = useSelector((s) => s.ui.toasts)
  if (!toasts.length) return null
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body
  )
}
