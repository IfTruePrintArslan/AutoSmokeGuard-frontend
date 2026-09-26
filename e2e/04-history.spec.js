import { test, expect, registerTestUser, loginAs, seedQueuedAnalyses, seedAnalysisWithSettings, SAMPLE } from './fixtures.js'

// This suite asserts *exact* row counts, filtered-set sizes, and page
// boundaries — none of which the shared demo account can guarantee. Every
// other spec file (and every repeated run of this one) keeps adding its own
// analyses to that account, which is exactly what made this suite order-
// dependent before (see defect D30: a previous run failed purely because
// unrelated "moderate" rows had accumulated in the shared history). A
// brand-new, uniquely-tagged user per run gives this suite a history table
// only it has ever written to.
test.describe('History', () => {
  let auth

  test.beforeAll(async () => {
    auth = await registerTestUser('history')
    // 12 freshly queued rows guarantees > 10 (the default page size) so
    // pagination has something real to page through, and guarantees rows
    // with no severity yet (freshly queued), which the severity-filter
    // assertion below relies on to prove the row set actually narrows.
    await seedQueuedAnalyses(12, { accessToken: auth.access, tag: 'history-pagination' })
    // A uniquely-named row this run owns outright, for the filename-search
    // assertion — not a row incidentally left behind by an unrelated spec.
    await seedAnalysisWithSettings(
      {},
      {
        accessToken: auth.access,
        mediaPath: SAMPLE.busSmoking,
        filename: 'sample_truck_smoking.jpg',
        tag: 'history-search',
      }
    )
  })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, auth)
  })

  test('shows rows for analyses already run, and filters/searches/paginates', async ({ page }) => {
    await page.goto('/history')

    const dataRows = () => page.locator('table tbody tr:has(td)')
    await expect(dataRows().first()).toBeVisible()

    const totalBefore = await dataRows().count()
    expect(totalBefore, 'expected rows for the analyses this run seeded').toBeGreaterThan(0)
    await page.screenshot({ path: 'e2e/__screenshots__/history.png', fullPage: true })

    // --- Filter by severity: URL updates and the row set narrows ---------
    await page.locator('[aria-label="Filter by severity"]').click()
    await page.getByRole('option', { name: 'Moderate' }).click()

    await expect(page).toHaveURL(/severity=moderate/)
    await page.waitForLoadState('networkidle')
    const filteredCount = await dataRows().count()
    expect(filteredCount, 'filtering by a concrete severity should exclude the severity-less seeded rows').toBeLessThan(totalBefore)

    // Clear the filter back to "all".
    await page.locator('[aria-label="Filter by severity"]').click()
    await page.getByRole('option', { name: 'All severities' }).click()
    await expect(page).not.toHaveURL(/severity=/)

    // --- Search by filename -----------------------------------------------
    await page.locator('#history-search').fill('sample_truck_smoking')
    await page.waitForTimeout(400) // debounce
    await expect(page).toHaveURL(/search=sample_truck_smoking/)
    const searchRows = dataRows()
    await expect(searchRows).not.toHaveCount(0)
    const count = await searchRows.count()
    for (let i = 0; i < count; i++) {
      await expect(searchRows.nth(i)).toContainText('sample_truck_smoking')
    }
    await page.locator('#history-search').fill('')
    await page.waitForTimeout(400)

    // --- Pagination ---------------------------------------------------------
    await expect(page.getByText(/page 1 of/i)).toBeVisible()
    const nextBtn = page.getByRole('button', { name: 'Next' })
    await expect(nextBtn).toBeEnabled()
    const firstPageFirstRowText = await dataRows().first().textContent()
    await nextBtn.click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText(/page 2 of/i)).toBeVisible()
    const secondPageFirstRowText = await dataRows().first().textContent()
    expect(secondPageFirstRowText).not.toEqual(firstPageFirstRowText)

    const prevBtn = page.getByRole('button', { name: 'Prev' })
    await prevBtn.click()
    await expect(page).toHaveURL(/page=1\b/)

    // --- Click through to an analysis detail --------------------------------
    await dataRows().first().getByRole('link', { name: 'View' }).click()
    await page.waitForURL(/\/analysis\/.+/)
    await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible()
  })
})
