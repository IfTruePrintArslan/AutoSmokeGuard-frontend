import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  REPORT_BUDGET_SECONDS,
  REPORT_BUDGET_MS,
  REPORT_POLL_BASE_MS,
  REPORT_POLL_MAX_MS,
  nextReportPollDelayMs,
  reportBudgetRemainingMs,
} from '../reportBudget'

// The client's willingness to wait for a report is a mirror of a server
// guarantee, and a mirror that can drift silently is worse than no mirror at
// all: the failure it produces (a "Generate PDF report" button offered for a
// PDF the server is still writing) looks like a UI nit and is actually a
// duplicated render plus a lie to the user. So the mirror is checked.
//
// Finding the backend (it is a *different repository*)
// ----------------------------------------------------
// frontend/ is its own git repo, so a standalone checkout — which is how CI
// clones it, and how the README tells collaborators to work — has no sibling
// backend/ at all. Resolving `../backend/...` and nothing else only ever
// worked because the author's frontend/ happens to sit inside FYP/; on a
// runner it was a hard ENOENT.
//
// Deleting this guard was not an option (it is the only thing standing
// between this constant and a silent divergence from the server's), and
// neither was an unconditional skip, which is green while verifying nothing.
// So the backend is *searched for* in the places it legitimately lives, and
// when it genuinely is not there the test skips with a message that names
// what was missing and how to supply it.
const BACKEND_ENV_VAR = 'ASG_BACKEND_PATH'

/** Every plausible root of the backend repo, most specific first. */
function backendRoots() {
  const override = (process.env[BACKEND_ENV_VAR] ?? '').trim()
  return [
    ...(override ? [resolve(override)] : []),
    resolve(process.cwd(), '_backend'), // sibling checkout made by CI
    resolve(process.cwd(), '../backend'), // umbrella working copy (FYP/)
    resolve(process.cwd(), '../_backend'),
  ]
}

/** The first root that actually contains `relativePath`, or null. */
function findInBackend(relativePath) {
  return backendRoots().map((root) => resolve(root, relativePath)).find(existsSync) ?? null
}

/** An explicit "missing input, not a pass" note for the skip. */
function missingBackendNote(relativePath) {
  return (
    `MISSING INPUT (this is not a pass): backend/${relativePath} was not found, so the ` +
    'report-budget drift guard could not run. It lives in the backend repository ' +
    '(IfTruePrintArslan/AutoSmokeGuard-backend), not in this one, so a standalone frontend ' +
    `checkout does not contain it. Looked in: ${backendRoots().join('; ')}. Set ` +
    `${BACKEND_ENV_VAR} to the backend checkout root to make this guard run.`
  )
}

const SERVICES_PY_RELATIVE = 'reports/services.py'

describe('report budget — parity with the server', () => {
  it('tracks backend REPORT_BUDGET_SECONDS exactly', (ctx) => {
    const SERVICES_PY = findInBackend(SERVICES_PY_RELATIVE)
    ctx.skip(SERVICES_PY === null, missingBackendNote(SERVICES_PY_RELATIVE))

    const source = readFileSync(SERVICES_PY, 'utf-8')
    const match = source.match(/^REPORT_BUDGET_SECONDS\s*=\s*(\d+)\s*$/m)

    expect(match, 'REPORT_BUDGET_SECONDS is no longer a plain literal in backend/reports/services.py').toBeTruthy()
    expect(
      Number(match[1]),
      'backend REPORT_BUDGET_SECONDS and frontend REPORT_BUDGET_SECONDS have drifted apart — ' +
        'the client must not give up on a report before the server has run out of time to produce one'
    ).toBe(REPORT_BUDGET_SECONDS)
  })

  it('derives REPORT_BUDGET_MS from the seconds value', () => {
    expect(REPORT_BUDGET_MS).toBe(REPORT_BUDGET_SECONDS * 1000)
  })
})

describe('reportBudgetRemainingMs', () => {
  const now = Date.parse('2026-01-01T00:05:00Z')

  it('grants the full budget to a run that has only just finished', () => {
    expect(reportBudgetRemainingMs('2026-01-01T00:05:00Z', now)).toBe(REPORT_BUDGET_MS)
  })

  it('counts down as the server spends its budget', () => {
    expect(reportBudgetRemainingMs('2026-01-01T00:04:50Z', now)).toBe(REPORT_BUDGET_MS - 10_000)
    expect(reportBudgetRemainingMs('2026-01-01T00:04:31Z', now)).toBe(1_000)
  })

  it('returns 0 once the budget is spent, and never goes negative', () => {
    expect(reportBudgetRemainingMs('2026-01-01T00:04:30Z', now)).toBe(0)
    // An analysis that finished hours ago is not "still rendering" — its
    // report is never coming, so the manual fallback is owed immediately
    // rather than after another full budget of spinning.
    expect(reportBudgetRemainingMs('2026-01-01T00:00:00Z', now)).toBe(0)
    expect(reportBudgetRemainingMs('2020-06-01T12:00:00Z', now)).toBe(0)
  })

  it('clamps rather than trusts when the client clock runs behind the server', () => {
    // A finish time "in the future" means skew, not a 2-minute-early report.
    expect(reportBudgetRemainingMs('2026-01-01T00:07:00Z', now)).toBe(REPORT_BUDGET_MS)
  })

  it('grants the full budget when the finish time is missing or unusable', () => {
    for (const value of [null, undefined, '', 'not-a-date', NaN]) {
      expect(reportBudgetRemainingMs(value, now)).toBe(REPORT_BUDGET_MS)
    }
  })

  it('accepts a Date as well as an ISO string', () => {
    expect(reportBudgetRemainingMs(new Date('2026-01-01T00:04:50Z'), now)).toBe(REPORT_BUDGET_MS - 10_000)
  })
})

describe('nextReportPollDelayMs', () => {
  it('keeps the first attempt short so a fast report still lands promptly', () => {
    // The common case is a still image whose PDF is written in well under a
    // second; widening the budget must not cost that case any latency.
    expect(nextReportPollDelayMs(0)).toBe(REPORT_POLL_BASE_MS)
  })

  it('backs off geometrically and never exceeds the ceiling', () => {
    const delays = Array.from({ length: 20 }, (_, i) => nextReportPollDelayMs(i))
    expect(delays[1]).toBeGreaterThan(delays[0])
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
      expect(delays[i]).toBeLessThanOrEqual(REPORT_POLL_MAX_MS)
    }
    expect(delays[delays.length - 1]).toBe(REPORT_POLL_MAX_MS)
  })

  it('covers the whole budget in a handful of requests, not a tight loop', () => {
    let elapsed = 0
    let polls = 0
    while (elapsed < REPORT_BUDGET_MS) {
      elapsed += nextReportPollDelayMs(polls)
      polls += 1
    }
    // 30s at a flat 500ms would be 60 requests; backoff must do far better.
    expect(polls).toBeLessThanOrEqual(12)
  })

  it('treats a nonsensical attempt index as the first attempt', () => {
    expect(nextReportPollDelayMs(-3)).toBe(REPORT_POLL_BASE_MS)
    expect(nextReportPollDelayMs(NaN)).toBe(REPORT_POLL_BASE_MS)
    expect(nextReportPollDelayMs(undefined)).toBe(REPORT_POLL_BASE_MS)
  })
})
