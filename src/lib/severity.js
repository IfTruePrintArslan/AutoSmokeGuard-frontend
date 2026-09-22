// Single source of truth for the backend severity vocabulary
// ("low" | "moderate" | "high") <-> the design system's `.sev-*` classes,
// display labels and chart colors. Every place in the app that needs to
// render a severity value should go through this module instead of
// re-deriving the mapping locally.

export const SEVERITY_ORDER = ['low', 'moderate', 'high']

export const SEVERITY_LABELS = { low: 'Low', moderate: 'Moderate', high: 'High' }

export const SEVERITY_COLORS = { low: '#4ade80', moderate: '#fbbf24', high: '#f87171' }

// Backend value "moderate" maps to the CSS class "sev-mod" (not "sev-moderate").
const SEVERITY_CLASS = { low: 'sev-low', moderate: 'sev-mod', high: 'sev-high' }

export function sevClass(severity) {
  return SEVERITY_CLASS[severity] || ''
}

export function sevLabel(severity) {
  return SEVERITY_LABELS[severity] || severity || 'Unknown'
}

export function sevColor(severity) {
  return SEVERITY_COLORS[severity] || '#8a8a8a'
}

// Converts an AnalysisRow/AnalysisDetail `severity_counts` object
// ({low, moderate, high}) into the same array shape the dashboard's
// `severity_distribution` already arrives in, so <SeverityDistribution>
// can render either source through one prop contract.
export function severityCountsToDistribution(counts = {}) {
  const total = SEVERITY_ORDER.reduce((sum, key) => sum + (counts?.[key] || 0), 0)
  return SEVERITY_ORDER.map((key) => {
    const value = counts?.[key] || 0
    return {
      key,
      label: SEVERITY_LABELS[key],
      value,
      pct: total ? Math.round((value / total) * 100) : 0,
      color: SEVERITY_COLORS[key],
    }
  })
}
