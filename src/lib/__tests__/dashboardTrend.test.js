import { describe, it, expect } from 'vitest'
import { summarizeDetectionSeries, MIN_TREND_DAYS } from '../dashboardTrend'

function day(label, detections, high = 0) {
  return { date: label, label, detections, high }
}

describe('summarizeDetectionSeries', () => {
  it('flags a brand-new account whose entire history landed on a single day as sparse', () => {
    // A zero-filled 30-day window with real activity on only the last day —
    // exactly the "flat line + one hairline spike" shape from the defect.
    const series = [
      ...Array.from({ length: 29 }, (_, i) => day(`day-${i}`, 0)),
      day('today', 6, 2),
    ]

    const summary = summarizeDetectionSeries(series)

    expect(summary.isEmpty).toBe(false)
    expect(summary.isSparse).toBe(true)
    expect(summary.activeDays).toHaveLength(1)
    expect(summary.totalDetections).toBe(6)
  })

  it('is not sparse once at least MIN_TREND_DAYS days have real activity', () => {
    const series = Array.from({ length: MIN_TREND_DAYS }, (_, i) => day(`day-${i}`, i + 1))

    const summary = summarizeDetectionSeries(series)

    expect(summary.isEmpty).toBe(false)
    expect(summary.isSparse).toBe(false)
  })

  it('treats an all-zero (or empty) series as empty, not sparse', () => {
    const allZero = Array.from({ length: 14 }, (_, i) => day(`day-${i}`, 0))
    expect(summarizeDetectionSeries(allZero)).toMatchObject({ isEmpty: true, isSparse: false, activeDays: [] })
    expect(summarizeDetectionSeries([])).toMatchObject({ isEmpty: true, isSparse: false })
    expect(summarizeDetectionSeries(undefined)).toMatchObject({ isEmpty: true, isSparse: false })
  })

  it('is stable regardless of how many total days are in the window, only how many have activity', () => {
    // 2 active days out of a 3-day window is exactly as sparse as 2 active
    // days out of a 90-day window.
    const shortWindow = summarizeDetectionSeries([day('a', 1), day('b', 2), day('c', 0)])
    const longWindow = summarizeDetectionSeries([
      day('a', 1),
      day('b', 2),
      ...Array.from({ length: 88 }, (_, i) => day(`pad-${i}`, 0)),
    ])
    expect(shortWindow.isSparse).toBe(true)
    expect(longWindow.isSparse).toBe(true)
  })
})
