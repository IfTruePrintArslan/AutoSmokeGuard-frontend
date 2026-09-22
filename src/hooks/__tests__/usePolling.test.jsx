import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import usePolling from '../usePolling'

// D12 — returning to a tab fires `visibilitychange` AND `focus`. The old
// guard was "is a timer pending?", which is false for the whole window
// between a tick starting and it rescheduling, so both handlers started a
// chain. `timeoutRef` can hold one handle, so the other chain became
// untracked: the poll rate doubled for the life of the page and an
// unstoppable timer kept firing while the tab was hidden.

const store = () => configureStore({ reducer: { noop: (state = {}) => state } })

function wrapperFor(testStore) {
  return function Wrapper({ children }) {
    return <Provider store={testStore}>{children}</Provider>
  }
}

let hidden = false

function setHidden(value) {
  hidden = value
}

function fireResumeEvents() {
  // Exactly what a browser does when a tab comes back to the foreground,
  // in the same task.
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('focus'))
}

describe('usePolling chain integrity (D12)', () => {
  let thunkCreator
  let testStore

  beforeEach(() => {
    vi.useFakeTimers()
    hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    thunkCreator = vi.fn((id) => ({ type: 'test/tick', payload: id }))
    testStore = store()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete document.hidden
  })

  async function flush() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it('two resume events in the same task produce exactly one tick and one pending timer', async () => {
    const { unmount } = renderHook(() => usePolling(thunkCreator, 'a1'), {
      wrapper: wrapperFor(testStore),
    })

    await flush()
    expect(thunkCreator).toHaveBeenCalledTimes(1)

    setHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(vi.getTimerCount()).toBe(0)

    setHidden(false)
    act(() => {
      fireResumeEvents()
    })

    // Both handlers ran; only one of them may have dispatched.
    expect(thunkCreator).toHaveBeenCalledTimes(2)

    await flush()
    // ...and only one chain may be scheduled. Two here is the untracked
    // second chain that used to run forever.
    expect(vi.getTimerCount()).toBe(1)

    unmount()
  })

  it('does not double the poll rate for the rest of the page after a resume', async () => {
    const { unmount } = renderHook(() => usePolling(thunkCreator, 'a1'), {
      wrapper: wrapperFor(testStore),
    })
    await flush()

    setHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    setHidden(false)
    act(() => {
      fireResumeEvents()
    })
    await flush()

    const before = thunkCreator.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    const ticks = thunkCreator.mock.calls.length - before

    // One chain backing off 1.5x to a 5000ms cap fits at most ~7 ticks into
    // 30s (and never more than one per 1000ms, its floor). A forked chain
    // doubles that.
    expect(ticks).toBeGreaterThan(0)
    expect(ticks).toBeLessThanOrEqual(8)
    expect(vi.getTimerCount()).toBe(1)

    unmount()
  })

  it('never fires a tick while the tab is hidden', async () => {
    const { unmount } = renderHook(() => usePolling(thunkCreator, 'a1'), {
      wrapper: wrapperFor(testStore),
    })
    await flush()

    setHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    setHidden(false)
    act(() => {
      fireResumeEvents()
    })
    await flush()

    // Hide again — every timer belonging to the chain must be cancelled, not
    // just the one the hook happens to be holding a handle for.
    setHidden(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(vi.getTimerCount()).toBe(0)

    const before = thunkCreator.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })
    expect(thunkCreator.mock.calls.length).toBe(before)

    unmount()
  })

  it('stops completely on unmount', async () => {
    const { unmount } = renderHook(() => usePolling(thunkCreator, 'a1'), {
      wrapper: wrapperFor(testStore),
    })
    await flush()
    const before = thunkCreator.mock.calls.length

    unmount()

    expect(vi.getTimerCount()).toBe(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })
    expect(thunkCreator.mock.calls.length).toBe(before)
  })

  it('stops as soon as isDone reports a terminal result', async () => {
    const isDone = (result) => result?.payload === 'a1'
    const { unmount } = renderHook(() => usePolling(thunkCreator, 'a1', { isDone }), {
      wrapper: wrapperFor(testStore),
    })

    await flush()
    expect(thunkCreator).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)

    // A resume event must not restart a chain that already finished.
    act(() => {
      fireResumeEvents()
    })
    expect(thunkCreator).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('does not poll at all when disabled or when id is null', async () => {
    const { unmount: u1 } = renderHook(() => usePolling(thunkCreator, null), {
      wrapper: wrapperFor(testStore),
    })
    await flush()
    expect(thunkCreator).not.toHaveBeenCalled()
    u1()

    const { unmount: u2 } = renderHook(() => usePolling(thunkCreator, 'a1', { enabled: false }), {
      wrapper: wrapperFor(testStore),
    })
    await flush()
    expect(thunkCreator).not.toHaveBeenCalled()
    u2()
  })

  it('restarts cleanly when the id changes, without leaving the old chain running', async () => {
    const { rerender, unmount } = renderHook(({ id }) => usePolling(thunkCreator, id), {
      wrapper: wrapperFor(testStore),
      initialProps: { id: 'a1' },
    })
    await flush()
    expect(thunkCreator).toHaveBeenCalledWith('a1')

    rerender({ id: 'a2' })
    await flush()

    expect(thunkCreator).toHaveBeenCalledWith('a2')
    expect(vi.getTimerCount()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    // Not a single tick may still be using the old id.
    const idsAfterSwitch = thunkCreator.mock.calls.slice(2).map(([id]) => id)
    expect(idsAfterSwitch.every((id) => id === 'a2')).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    unmount()
  })
})
