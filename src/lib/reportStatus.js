/**
 * The server's explicit answer to "is a PDF still being generated for this
 * analysis?", and how much of it the client is entitled to act on.
 *
 * `GET /api/analysis/{id}` carries `report_status` (see API_CONTRACT.md,
 * "Analysis"). It exists because `report: null` on a `done` analysis is
 * ambiguous: the PDF may be mid-render, or its render may have died two
 * seconds in. The client used to resolve that ambiguity with a stopwatch —
 * assume "still rendering" until the server's 30s budget ran out — which is
 * right for a slow render and badly wrong for a fast failure, where it means
 * twenty-eight seconds of disabled "Preparing report…" for work that is
 * already over.
 *
 * This does **not** replace `lib/reportBudget.js`. The budget is still the
 * ceiling on the client's patience (a worker that dies mid-render never sends
 * anything at all, so a signal that says `generating` can go stale forever)
 * and it is still the whole story against a server too old to send the field.
 * This module only lets the client stop waiting *early*, when the server has
 * said there is nothing left to wait for.
 */

/**
 * The closed vocabulary, mirroring `REPORT_STATUS_CHOICES` in
 * `backend/analysis/models.py`. Hand-mirrored, like `REPORT_BUDGET_SECONDS`
 * before it, and checked the same way: `__tests__/reportStatus.test.js`
 * parses the Python source and fails if the two drift apart.
 */
export const REPORT_STATUS = Object.freeze({
  /** Nothing attempted yet. */
  PENDING: 'pending',
  /** The server is rendering the PDF right now. */
  GENERATING: 'generating',
  /** The PDF exists; `report` on the same payload is non-null. */
  READY: 'ready',
  /** The last attempt raised. Nothing is coming without a manual request. */
  FAILED: 'failed',
  /** No automatic report applies: auto-PDF off, or the run itself failed. */
  SKIPPED: 'skipped',
})

export const REPORT_STATUS_VALUES = Object.freeze(Object.values(REPORT_STATUS))

/**
 * The value a payload carries, or `null` when it carries no usable signal.
 *
 * Both unknowns collapse to `null` on purpose. An older server omits the key
 * entirely; a newer one might add a state this build has never heard of. In
 * either case the honest position is "the server has not told me anything I
 * understand", and the caller falls back to the wall-clock budget rather than
 * guessing at a word it cannot interpret.
 *
 * @param {object|null|undefined} detail an analysis detail payload
 * @returns {string|null} a recognised `report_status`, else `null`
 */
export function reportStatusOf(detail) {
  const value = detail?.report_status
  return REPORT_STATUS_VALUES.includes(value) ? value : null
}

/**
 * True when the server says a render is in flight *right now*.
 *
 * Only `generating` qualifies. `pending` deliberately does not: it means the
 * server has not started, which is the state a run sits in for the instant
 * between finishing and its post-run report hook firing — including on runs
 * that will never produce a PDF at all. Treating it as "in flight" would
 * flash a "Preparing report…" the server never promised. `pending` therefore
 * falls through to the existing `auto_generate_pdf` + budget reasoning, which
 * answers it correctly either way.
 *
 * @param {string|null} status from {@link reportStatusOf}
 */
export function serverIsGeneratingReport(status) {
  return status === REPORT_STATUS.GENERATING
}

/**
 * True when the server says no report is coming on its own.
 *
 * This is the whole point of the field. `failed` is the fast-failure case the
 * budget could not see; `skipped` is a run that was never going to produce a
 * PDF. Both mean the manual "Generate PDF report" fallback is the honest
 * state and is owed *now*, not after the budget expires.
 *
 * @param {string|null} status from {@link reportStatusOf}
 */
export function serverHasNoReportComing(status) {
  return status === REPORT_STATUS.FAILED || status === REPORT_STATUS.SKIPPED
}
