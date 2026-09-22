// Shared UI copy that must stay word-for-word identical everywhere the same
// value is rendered, so a fix in one place cannot drift out of sync with
// the others (see DashboardPage, AnalysisPage, HistoryPage).

// `total_vehicles` (and any count derived from it, e.g. `vehicles.length`)
// is a raw per-frame detection count, not a count of distinct vehicles — the
// same vehicle can be, and typically is, counted once per sampled frame it
// appears in. This explains that honestly wherever the number is shown.
export const VEHICLE_DETECTIONS_LABEL = 'Vehicle detections'

export const VEHICLE_DETECTIONS_TOOLTIP_TEXT =
  'Counts vehicle detections across sampled frames, not unique vehicles — the same vehicle is typically detected in more than one frame. This number scales with the frame-sampling rate, so the same footage analyzed at a higher sample rate will report a larger figure.'
