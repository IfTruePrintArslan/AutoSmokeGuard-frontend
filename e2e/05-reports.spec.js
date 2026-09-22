import { test, expect, DEMO_AUTH, readFileHead } from './fixtures.js'

test.use({ storageState: DEMO_AUTH })

test.describe('Reports', () => {
  test('lists real filenames and severities, and downloads a real PDF', async ({ page }) => {
    await page.goto('/reports')

    const rows = page.locator('table tbody tr:has(td)')
    await expect(rows.first()).toBeVisible()
    await page.screenshot({ path: 'e2e/__screenshots__/reports.png', fullPage: true })

    const firstRow = rows.first()
    const sourceCell = firstRow.locator('td').nth(1)
    await expect(sourceCell).not.toHaveText('—')
    await expect(sourceCell).not.toBeEmpty()

    const severityBadge = firstRow.locator('.sev')
    await expect(severityBadge).toBeVisible()
    const severityText = (await severityBadge.textContent())?.trim()
    expect(severityText, 'severity badge should render a real label, not a dash').not.toMatch(/^—$/)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      firstRow.getByRole('button', { name: 'Download' }).click(),
    ])
    const path = await download.path()
    expect(path).toBeTruthy()
    expect(readFileHead(path, 5).startsWith('%PDF')).toBe(true)
  })
})
