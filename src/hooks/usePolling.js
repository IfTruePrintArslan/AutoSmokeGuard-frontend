import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'

const START_MS = 1000
const MAX_MS = 5000
const BACKOFF = 1.5

/**
 * Polls a Redux thunk on an interval with exponential backoff (starts at
 * 1000ms, ×1.5 each tick, capped at 5000ms). Pauses while the tab is hidden
 * and resumes on visibility/focus. Cleans up on unmount and whenever `id`
 * changes.
 *
 * Exactly one chain is live at a time. That is not free: returning to a tab
 * fires `visibilitychange` *and* `focus`, and a dispatch is in flight across
 * an `await`, so "is a timer pending?" is not on its own a sufficient guard —
 * the window between a tick starting and it rescheduling would let a second
 * handler start a parallel chain whose timer handle then overwrites the
 * first, leaving the original untracked and unstoppable. Two guards close it:
 * an in-flight flag that covers the await window, and a monotonic epoch that
 * a chain captures on creation, so any tick or timeout belonging to a
 * superseded chain refuses to dispatch or reschedule.
 *
 * @param {Function} thunkCreator   an async-thunk action creator, dispatched
 *                                  as `thunkCreator(id)` on every tick
 * @param {*} id                    argument passed to thunkCreator; polling
 *                                  is entirely paused while id is null/undefined
 * @param {Object} [options]
 * @param {(result: any) => boolean} [options.isDone]  given the dispatched
 *   thunk's settled action, return true to stop polling (e.g. once a status
 *   reaches a terminal value)
 * @param {boolean} [options.enabled=true]
 */
export default function usePolling(thunkCreator, id, { isDone, enabled = true } = {}) {
  const dispatch = useDispatch()
  const timeoutRef = useRef(null)
  const delayRef = useRef(START_MS)
  const stoppedRef = useRef(false)
  const inFlightRef = useRef(false)
  const epochRef = useRef(0)
  const isDoneRef = useRef(isDone)

  useEffect(() => {
    isDoneRef.current = isDone
  })

  useEffect(() => {
    // Every effect run supersedes whatever came before it, even when the
    // previous cleanup could not stop work that was already awaiting.
    const epoch = (epochRef.current += 1)

    if (!enabled || id === null || id === undefined) return undefined

    stoppedRef.current = false
    inFlightRef.current = false
    delayRef.current = START_MS

    const isCurrent = () => epoch === epochRef.current && !stoppedRef.current

    function clearPending() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function scheduleNext() {
      if (!isCurrent() || document.hidden) return
      // Never leak a handle: if something already scheduled, that timer is
      // this chain's and must be replaced, not orphaned.
      clearPending()
      const delay = delayRef.current
      delayRef.current = Math.min(delayRef.current * BACKOFF, MAX_MS)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        tick()
      }, delay)
    }

    async function tick() {
      // The in-flight flag is set synchronously, before the first await, so
      // a second resume event landing in the same task cannot slip past it.
      if (!isCurrent() || inFlightRef.current) return
      inFlightRef.current = true
      let result
      try {
        result = await dispatch(thunkCreator(id))
      } finally {
        // Only this chain may clear the flag — a superseded tick settling
        // late must not unlock the chain that replaced it.
        if (epoch === epochRef.current) inFlightRef.current = false
      }
      if (!isCurrent()) return
      if (isDoneRef.current && isDoneRef.current(result)) {
        stoppedRef.current = true
        return
      }
      scheduleNext()
    }

    function resume() {
      // A pending timer or an in-flight request means the chain is alive;
      // starting another here is what doubles the poll rate for the life of
      // the page.
      if (!isCurrent() || timeoutRef.current || inFlightRef.current) return
      tick()
    }

    function onVisibilityChange() {
      if (document.hidden) {
        clearPending()
      } else {
        resume()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onVisibilityChange)

    tick()

    return () => {
      stoppedRef.current = true
      // Retire the epoch so an awaiting tick from this chain can neither
      // reschedule nor clear the in-flight flag of its successor.
      epochRef.current += 1
      clearPending()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onVisibilityChange)
    }
  }, [id, enabled, dispatch, thunkCreator])
}
