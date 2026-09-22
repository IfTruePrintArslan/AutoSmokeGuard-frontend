import { test, expect, DEMO_AUTH, SAMPLE } from './fixtures.js'

test.use({ storageState: DEMO_AUTH })

// The "negative" control: a clean street scene with no vehicles/smoke should
// never be reported as having any smoke severity.

test.describe('Clean control', () => {
  test('a clean image analyses to zero smoke regions with no false severity badge', async ({ page }) => {
    await page.goto('/upload')
    await page.locator('input[type="file"]').setInputFiles(SAMPLE.streetClean)

    const startBtn = page.getByRole('button', { name: /start analysis|starting/i })
    await expect(startBtn).toBeEnabled({ timeout: 60_000 })
    await startBtn.click()
    await page.waitForURL(/\/analysis\/.+/, { timeout: 30_000 })

    await expect(page.locator('.card-head', { hasText: 'Detections' }).or(page.getByText('Analysis failed')))
      .toBeVisible({ timeout: 150_000 })

    const failed = await page.getByText('Analysis failed').isVisible().catch(() => false)
    expect(failed, 'Analysis pipeline reported "failed" for a known-clean sample').toBe(false)

    const smokeCard = page.locator('.card', { hasText: 'Smoke regions' })
    await expect(smokeCard).toContainText('0')

    // No severity badge should claim low/moderate/high for a clean scene —
    // it should render the neutral "Unknown" pill (severity is null/None).
    const severityCard = page.locator('.card', { hasText: 'Overall severity' })
    await expect(severityCard.locator('.sev')).toContainText(/unknown/i)
    await expect(severityCard.locator('.sev-low, .sev-mod, .sev-high')).toHaveCount(0)
  })
})
