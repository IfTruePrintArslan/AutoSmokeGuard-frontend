import { test, expect, DEMO_AUTH, seedSlowVideoAnalysis } from './fixtures.js'

test.use({ storageState: DEMO_AUTH })

// The old static mockup hardcoded these three KPI numbers — asserting the
// live values differ from them is a cheap, concrete way to prove the
// dashboard is reading real data and not a leftover fixture.
const MOCKUP_TOTAL_ANALYSES = '248'
const MOCKUP_HIGH_SEVERITY = '32'
const MOCKUP_REPORTS_ISSUED = '196'

test.describe('Dashboard', () => {
  test('KPI values are real, charts render, and the processing queue reflects an in-flight job', async ({ page }) => {
    await page.goto('/dashboard')

    const kpiValue = (label) => page.locator('.card', { hasText: label }).locator('.mono').first()

    const totalAnalyses = (await kpiValue('Total analyses').textContent())?.trim()
    const highSeverity = (await kpiValue('High severity').textContent())?.trim()
    const reportsIssued = (await kpiValue('Reports issued').textContent())?.trim()

    expect(Number(totalAnalyses), 'total analyses should be a real, positive number').toBeGreaterThan(0)
    expect(totalAnalyses).not.toBe(MOCKUP_TOTAL_ANALYSES)
    expect(highSeverity).not.toBe(MOCKUP_HIGH_SEVERITY)
    expect(reportsIssued).not.toBe(MOCKUP_REPORTS_ISSUED)

    // The KPI should be at least as large as the rows we know we created
    // across the earlier journeys (2 real + 9 seeded + this spec's own seed).
    expect(Number(totalAnalyses)).toBeGreaterThanOrEqual(11)

    // --- Charts actually render data, not an empty <svg> --------------------
    const lineChartCard = page.locator('.card', { hasText: 'Detections over time' })
    await expect(lineChartCard.locator('svg path')).not.toHaveCount(0)

    const donutCard = page.locator('.card', { hasText: 'Severity distribution' }).first()
    if (await donutCard.getByText('No detections yet.').isVisible().catch(() => false)) {
      throw new Error('Severity distribution donut reports "No detections yet." despite analyses having run')
    }
    await expect(donutCard.locator('svg path')).not.toHaveCount(0)

    // Recharts animates the donut in on mount (~a few hundred ms) — give it
    // a moment to settle before the deliverable screenshot, otherwise it
    // captures a mid-animation sliver instead of the finished ring.
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'e2e/__screenshots__/dashboard.png', fullPage: true })

    // --- Processing queue reflects a real in-flight job ----------------------
    // A still image finishes in well under 100ms here (measured directly
    // against the API) — too fast for any browser round trip to observe —
    // so this uses a video with frame_sample_rate=1, which empirically
    // takes a couple of real seconds, to give the dashboard a fair chance
    // to actually show it mid-flight.
    await seedSlowVideoAnalysis()

    const dashboardLink = page.getByRole('link', { name: 'Dashboard' })
    const uploadLink = page.getByRole('link', { name: 'Upload' })

    await expect
      .poll(
        async () => {
          // Client-side route bounce (not page.reload()) — much cheaper
          // than a full reload, so more polls fit inside the job's window.
          await uploadLink.click()
          await dashboardLink.click()
          const queueCard = page.locator('.card', { hasText: 'Processing queue' })
          return (await queueCard.textContent()) || ''
        },
        { timeout: 20_000, intervals: [50, 100, 150, 250, 400] }
      )
      .toContain('sample_truck_smoking.mp4')
  })
})
