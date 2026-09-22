import { useId, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

// Hand-rolled accessible tooltip trigger — no Radix Tooltip is installed, so
// this implements the minimum accessible contract itself: a focusable
// trigger, `aria-describedby` wired to the content (kept in the DOM at all
// times so assistive tech can reach it even while visually hidden), shown on
// hover/focus, and dismissible with Escape without closing anything else on
// the page (`stopPropagation`, mirroring ConfirmDialog's Esc handling).
export default function InfoTooltip({ label, children, className = '', panelClassName = '' }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const triggerRef = useRef(null)

  function show() {
    setOpen(true)
  }

  function hide() {
    setOpen(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-line-2 text-[9.5px] font-bold leading-none text-text-2 bg-transparent cursor-help hover:text-text hover:border-text-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-3"
        aria-label={label}
        aria-describedby={tooltipId}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={onKeyDown}
      >
        i
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'absolute z-20 left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] w-max max-w-[240px] rounded-[8px] border border-line-2 bg-[#1a1a1a] px-2.5 py-2 text-[11.5px] leading-snug text-text-2 shadow-lg transition-opacity duration-100',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
          panelClassName
        )}
      >
        {children}
      </span>
    </span>
  )
}
