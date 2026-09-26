import { test, expect, DEMO_AUTH, seedAnalysisWithSettings } from './fixtures.js'

test.use({ storageState: DEMO_AUTH })

// The results hero's report control is a three-state machine:
//
//   "Download PDF"        report exists — the only actionable end state
//   "Preparing report…"   disabled; the server is still allowed to be working
//   "Generate PDF report" no report is coming on its own; manual fallback
//
// The middle state exists because `auto_generate_pdf` analyses flip to a
// terminal status slightly before the server has finished writing the PDF.
// Offering "Generate PDF report" during that window is a lie: it is a call to
// action for work already in flight, and pressing it forces a duplicate
// render the server then has to serialise behind the one already running.
//
// How long that window may last is NOT a UI guess. The server gives itself
// REPORT_BUDGET_SECONDS = 30 (backend/reports/services.py, the UC-07 NFR) to
// produce a report, so the client must stay patient for exactly that long —
// no longer (a report that never came must not spin forever) and, crucially,
// no shorter.
//
// These tests inject timing rather than hoping for it. The real pipeline
// writes the PDF for a still image in ~30ms, so a test that merely loads the
// page and watches proves nothing about a slow render — it is green whatever
// the client's patience is set to. Holding the `report` field back on the
// wire for a fixed window is what makes the slow case actually testable.
//
// The budget is the client's *ceiling*, not its only evidence. The detail
// payload also carries `report_status` (API_CONTRACT.md, "Analysis"), the
// server stating outright whether a PDF is still coming — because a render
// that dies after two seconds looks exactly like one still in progress to
// anything holding only a stopwatch, and waiting the full 30s out for it is
// the same kind of lie in the opposite direction. The last test covers that:
// a failure the server has already reported must reach the user at once.

// Rewrites GET /api/analysis/{id} on the wire. The real request still goes to
// the real server (`route.fetch()`), so everything except the field under
// test stays honest.
async function interceptDetail(page, analysisId, transform) {
  await page.route(
    (url) => url.pathname === `/api/analysis/${analysisId}`,
    async (route) => {
      const response = await route.fetch()
      let body
      try {
        body = await response.json()
      } catch {
        await route.fulfill({ response })
        return
      }
      await route.fulfill({
        status: response.status(),
        contentType: 'application/json',
        body: JSON.stringify(transform(body) ?? body),
      })
    }
  )
}

const heroButton = (page) => page.locator('.card-head button').first()
const downloadBtn = (page) => page.getByRole('button', { name: /download pdf/i })
const manualBtn = (page) => page.getByRole('button', { name: /generate pdf report/i })

// Samples every label the hero button renders until `stop()` says otherwise.
async function watchLabels(page, { untilMs, stopWhen }) {
  const seen = new Set()
  const deadline = Date.now() + untilMs
  while (Date.now() < deadline) {
    const text = (await heroButton(page).textContent().catch(() => null))?.trim()
    if (text) seen.add(text)
    if (stopWhen && (await stopWhen())) break
    await page.waitForTimeout(80)
  }
  return seen
}

const sawManualLabel = (labels) => [...labels].some((label) => /^generate pdf report$/i.test(label))

test.describe('Report generation truthfulness', () => {
  test('a report that lands fast goes straight to "Download PDF", never offering the manual button on the way', async ({ page }) => {
    const created = await seedAnalysisWithSettings({ auto_generate_pdf: true }, { tag: 'report-truthfulness' })
    expect(created?.analysis_id, 'seed analysis did not return an analysis_id').toBeTruthy()

    await page.goto(`/analysis/${created.analysis_id}`)

    const labels = await watchLabels(page, {
      untilMs: 20_000,
      stopWhen: () => downloadBtn(page).isVisible().catch(() => false),
    })

    // The report must actually land — the download button proves the whole
    // journey (analyze -> auto-generate -> poll -> render) really happened.
    await expect(downloadBtn(page)).toBeVisible({ timeout: 20_000 })

    expect(
      sawManualLabel(labels),
      `saw the manual "Generate PDF report" label while an auto-generated report was on its way — labels observed: ${[...labels].join(', ')}`
    ).toBe(false)

    // Defect 1: the detection count is honestly labelled here too.
    await expect(page.locator('.card', { hasText: 'Vehicle detections' })).toBeVisible()
    await expect(page.getByText('Vehicles detected')).toHaveCount(0)
  })

  test('stays on "Preparing report…" through a SLOW render — the manual button must not appear while the server is still inside its budget', async ({ page }) => {
    const created = await seedAnalysisWithSettings({ auto_generate_pdf: true }, { tag: 'report-truthfulness-slow' })
    expect(created?.analysis_id).toBeTruthy()

    // Hold the report back for 12s: far past the ~4.7s the client used to
    // wait, far inside the 30s the server is entitled to take. A client that
    // gives up inside this window offers a button for a PDF that is, at that
    // very moment, being written.
    const SLOW_MS = 12_000
    const releaseAt = Date.now() + SLOW_MS
    await interceptDetail(page, created.analysis_id, (body) =>
      Date.now() < releaseAt ? { ...body, report: null } : body
    )

    await page.goto(`/analysis/${created.analysis_id}`)
    await expect(page.locator('.card-head', { hasText: 'Detections' })).toBeVisible({ timeout: 30_000 })

    const labels = await watchLabels(page, { untilMs: releaseAt - Date.now() })

    expect(
      sawManualLabel(labels),
      `the manual "Generate PDF report" button was offered while the server was still within its 30s report budget — labels observed: ${[...labels].join(', ')}`
    ).toBe(false)
    expect(
      [...labels].some((label) => /preparing report/i.test(label)),
      `expected the honest "Preparing report…" state during the slow render — labels observed: ${[...labels].join(', ')}`
    ).toBe(true)

    // Once the server's report is allowed through, the wait pays off.
    await expect(downloadBtn(page)).toBeVisible({ timeout: 30_000 })
  })

  test('offers a working manual "Generate PDF report" as soon as the server budget is genuinely exhausted', async ({ page }) => {
    const created = await seedAnalysisWithSettings({ auto_generate_pdf: true }, { tag: 'report-truthfulness-exhausted' })
    expect(created?.analysis_id).toBeTruthy()

    // No report, and a finish time ten minutes old: the server's 30s budget
    // is long spent, so this report is not "on its way", it is not coming.
    // The manual fallback is the honest state and it is owed immediately —
    // waiting is exactly as wrong here as giving up early was above.
    let withholdReport = true
    await interceptDetail(page, created.analysis_id, (body) =>
      withholdReport
        ? { ...body, report: null, end_time: new Date(Date.now() - 10 * 60_000).toISOString() }
        : body
    )

    await page.goto(`/analysis/${created.analysis_id}`)
    await expect(page.locator('.card-head', { hasText: 'Detections' })).toBeVisible({ timeout: 30_000 })

    await expect(
      manualBtn(page),
      'an analysis whose report budget expired long ago must offer the manual button at once, not after a wait'
    ).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText(/preparing report/i)).toHaveCount(0)

    // And the fallback must actually work — it is the only way out of this
    // state for a user whose report generation really did fail.
    withholdReport = false
    await manualBtn(page).click()
    await expect(downloadBtn(page)).toBeVisible({ timeout: 30_000 })
  })

  test('drops to the manual "Generate PDF report" the instant the server reports a FAILED render — not 30 seconds later', async ({ page }) => {
    const created = await seedAnalysisWithSettings({ auto_generate_pdf: true }, { tag: 'report-truthfulness-failed' })
    expect(created?.analysis_id).toBeTruthy()

    // A fast failure. Every clue the old, clock-only reasoning had says "be
    // patient": auto_generate_pdf is on, and the run finished just now, so
    // essentially the whole 30s budget is unspent. Only `report_status` says
    // the render is already over — and it is the one thing here that is true.
    //
    // `end_time` is pinned to a single instant rather than restamped per
    // response, so the budget this is measured against is a fixed 30s window
    // from a known moment instead of one that keeps sliding forward.
    const finishedAt = new Date().toISOString()
    let injectFailure = true
    await interceptDetail(page, created.analysis_id, (body) =>
      injectFailure
        ? { ...body, report: null, report_status: 'failed', end_time: finishedAt }
        : body
    )

    const openedAt = Date.now()
    await page.goto(`/analysis/${created.analysis_id}`)
    await expect(page.locator('.card-head', { hasText: 'Detections' })).toBeVisible({ timeout: 30_000 })

    await expect(
      manualBtn(page),
      'the server had already reported a FAILED report render; the manual fallback is owed immediately, not after the 30s budget expires'
    ).toBeVisible({ timeout: 5_000 })

    const waited = Date.now() - openedAt
    expect(
      waited,
      `the manual button took ${waited}ms to appear — that is the 30s report budget being waited out, which is exactly what report_status exists to avoid`
    ).toBeLessThan(20_000)
    await expect(page.getByText(/preparing report/i)).toHaveCount(0)

    // And the way out has to actually work: a user whose automatic render
    // failed gets their PDF from this button or not at all.
    injectFailure = false
    await manualBtn(page).click()
    await expect(downloadBtn(page)).toBeVisible({ timeout: 30_000 })
  })

  test('shows the manual "Generate PDF report" button when auto-generation is off', async ({ page }) => {
    const created = await seedAnalysisWithSettings({ auto_generate_pdf: false }, { tag: 'report-truthfulness-manual' })
    expect(created?.analysis_id).toBeTruthy()

    await page.goto(`/analysis/${created.analysis_id}`)

    // No report is coming on its own — the manual button is the honest state here.
    await expect(manualBtn(page)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/preparing report/i)).toHaveCount(0)
  })
})
