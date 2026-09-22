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
  const isDoneRef = useRef(isDone)

  useEffect(() => {
    isDoneRef.current = isDone
  })

  useEffect(() => {
    if (!enabled || id === null || id === undefined) return undefined

    stoppedRef.current = false
    delayRef.current = START_MS

    function clearPending() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function scheduleNext() {
      if (stoppedRef.current || document.hidden) return
      const delay = delayRef.current
      delayRef.current = Math.min(delayRef.current * BACKOFF, MAX_MS)
      timeoutRef.current = setTimeout(tick, delay)
    }

    async function tick() {
      if (stoppedRef.current) return
      timeoutRef.current = null
      const result = await dispatch(thunkCreator(id))
      if (stoppedRef.current) return
      if (isDoneRef.current && isDoneRef.current(result)) {
        stoppedRef.current = true
        return
      }
      scheduleNext()
    }

    function onVisibilityChange() {
      if (document.hidden) {
        clearPending()
      } else if (!stoppedRef.current && !timeoutRef.current) {
        tick()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onVisibilityChange)

    tick()

    return () => {
      stoppedRef.current = true
      clearPending()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onVisibilityChange)
    }
  }, [id, enabled, dispatch, thunkCreator])
}
