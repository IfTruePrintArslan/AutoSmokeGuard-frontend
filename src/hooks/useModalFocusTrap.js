import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Shared accessible-modal behaviour for hand-rolled dialogs (no Radix Dialog
 * is installed): on open, remembers whatever had focus, moves focus into the
 * dialog, traps Tab/Shift+Tab inside it, handles Escape, and restores focus
 * to what had it before, on close.
 *
 * `onClose` is read through a ref rather than being an effect dependency —
 * callers frequently pass a fresh inline arrow on every render (e.g.
 * `onCancel={() => setDeleteTarget(null)}`), and depending on it directly
 * would tear the effect down and re-run it on every parent re-render: focus
 * gets yanked to whatever the cleanup's restore-target was, then
 * `previouslyFocused` gets re-captured as an element *inside* the dialog
 * itself. Depending on `open` alone keeps one capture/restore per actual
 * open/close.
 *
 * Falls back to the dialog surface itself (which callers must give
 * `tabIndex={-1}`) as the Tab-trap anchor when there are currently no
 * focusable descendants at all (e.g. every button is temporarily
 * `disabled` while an action is in flight) — otherwise the trap silently
 * stops working the moment controls are disabled.
 *
 * @param {boolean} open
 * @param {() => void} [onClose] called on Escape
 * @returns {import('react').RefObject} ref to attach to the dialog surface
 */
export function useModalFocusTrap(open, onClose) {
  const containerRef = useRef(null)
  const previouslyFocused = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current = document.activeElement

    function getFocusable() {
      return containerRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    }

    const first = getFocusable()?.[0]
    if (first) first.focus()
    else containerRef.current?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (!focusable || !focusable.length) {
        // Nothing tabbable right now (e.g. every button is `disabled` mid-
        // action) — keep focus pinned inside the dialog rather than letting
        // Tab escape to the page behind it.
        e.preventDefault()
        containerRef.current?.focus()
        return
      }
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (previouslyFocused.current?.focus) previouslyFocused.current.focus()
    }
  }, [open])

  return containerRef
}

export default useModalFocusTrap
