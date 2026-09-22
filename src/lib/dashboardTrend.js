// Pure helpers for the dashboard's "Detections over time" chart.
//
// `detections_over_time` is zero-filled across the whole requested window
// (see API_CONTRACT.md, "Dashboard") — every day in range gets an entry even
// when nothing happened that day. For a brand-new account (or one whose
// entire history happened to land on a single day) that means the series is
// mostly zeros with one lone non-zero point, which a smoothed line/area
// chart renders as a flat line with a single hairline spike at the edge —
// visually indistinguishable from a broken chart. These helpers detect that
// degenerate shape so the page can render something honest instead.

// Fewer than this many distinct days with real activity is "not enough
// history yet" — too sparse for a trend line to mean anything.
export const MIN_TREND_DAYS = 3

/**
 * @param {Array<{date?:string,label?:string,detections?:number,high?:number}>} series
 */
export function summarizeDetectionSeries(series) {
  const safeSeries = Array.isArray(series) ? series : []
  const activeDays = safeSeries.filter((d) => (d?.detections ?? 0) > 0)
  const totalDetections = activeDays.reduce((sum, d) => sum + (d.detections ?? 0), 0)

  return {
    series: safeSeries,
    activeDays,
    totalDetections,
    // No entries at all, or every entry is zero — nothing to plot as a trend.
    isEmpty: activeDays.length === 0,
    // Some real activity exists, but it's concentrated in too few days to
    // read as a trend — the "looks broken" case this module exists for.
    isSparse: activeDays.length > 0 && activeDays.length < MIN_TREND_DAYS,
  }
}
