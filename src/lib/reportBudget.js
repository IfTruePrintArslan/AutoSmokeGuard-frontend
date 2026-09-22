/**
 * How long the client is willing to wait for an auto-generated PDF report
 * before it stops believing one is coming.
 *
 * This is not a UI preference — it is a mirror of a server guarantee, and it
 * is the client's job to track it rather than invent its own shorter one.
 */

/**
 * The server's own wall-clock budget for rendering one report, from
 * `backend/reports/services.py`:
 *
 *     REPORT_BUDGET_SECONDS = 30   # the UC-07 non-functional requirement
 *
 * Giving up before this has elapsed is a correctness bug, not just an
 * impatient UI: the results screen would swap its honest disabled
 * "Preparing report…" state for a "Generate PDF report" call to action while
 * the server is *actively writing that very PDF*. Acting on it forces a
 * duplicate render of work already in flight (the server serialises it
 * behind a per-analysis lock, so the user simply waits twice as long for
 * bytes that were already on their way).
 *
 * The backend does not expose this value over the API — no settings,
 * system-config or runtime endpoint carries it — so it is mirrored here by
 * hand. The mirror is not left to trust: `__tests__/reportBudget.test.js`
 * parses the Python source and fails if the two ever drift apart. If the
 * server's budget changes, that test is what tells you to change this line.
 */
export const REPORT_BUDGET_SECONDS = 30

export const REPORT_BUDGET_MS = REPORT_BUDGET_SECONDS * 1000

// Poll backoff. The first attempt stays deliberately short so the common
// case — a small image whose PDF lands in a few hundred milliseconds — still
// flips to "Download PDF" promptly; from there each wait grows by half again
// up to a 5s ceiling, so covering the full 30s budget costs ~10 requests
// rather than 60 tight ones.
export const REPORT_POLL_BASE_MS = 500
export const REPORT_POLL_MAX_MS = 5000
export const REPORT_POLL_BACKOFF = 1.5

/**
 * Delay before report-poll attempt `attempt` (0-based).
 *
 * @param {number} attempt zero-based attempt index
 * @returns {number} milliseconds to wait, capped at `REPORT_POLL_MAX_MS`
 */
export function nextReportPollDelayMs(attempt) {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0
  const raw = REPORT_POLL_BASE_MS * REPORT_POLL_BACKOFF ** n
  return Math.round(Math.min(raw, REPORT_POLL_MAX_MS))
}

/**
 * How much of the server's report budget is still unspent.
 *
 * Anchored on when the analysis actually *finished on the server*, not on
 * when this browser happened to open the page. That distinction is the whole
 * point: an analysis that finished two hours ago with no report is not
 * "still rendering", it is one whose report is never coming, and making that
 * user stare at a spinner for another 30 seconds would be a lie. Equally, an
 * analysis that finished 200ms ago deserves the full remaining budget even
 * if the tab was opened only now.
 *
 * Clock skew is handled by clamping rather than by trusting: a client whose
 * clock runs behind the server's would compute a negative elapsed time, and
 * gets the full budget instead of a nonsensical one.
 *
 * @param {string|number|Date|null|undefined} finishedAt server finish time
 *   (`end_time`, falling back to `created_at`); an unparseable or absent
 *   value yields the full budget, since nothing has been proven to be late
 * @param {number} [now] current epoch ms, injectable for tests
 * @returns {number} milliseconds remaining, clamped to [0, REPORT_BUDGET_MS]
 */
export function reportBudgetRemainingMs(finishedAt, now = Date.now()) {
  if (finishedAt === null || finishedAt === undefined || finishedAt === '') {
    return REPORT_BUDGET_MS
  }

  const finished = finishedAt instanceof Date ? finishedAt.getTime() : new Date(finishedAt).getTime()
  if (!Number.isFinite(finished)) return REPORT_BUDGET_MS

  const elapsed = now - finished
  if (!(elapsed > 0)) return REPORT_BUDGET_MS

  return Math.max(0, REPORT_BUDGET_MS - elapsed)
}
