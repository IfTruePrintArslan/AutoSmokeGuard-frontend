import { test, expect, DEMO_AUTH } from './fixtures.js'

test.use({ storageState: DEMO_AUTH })

test.describe('Responsive layout', () => {
  test('desktop (1280px): sidebar is in-flow, no drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')

    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    const box = await sidebar.boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(0)

    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeHidden()

    await page.screenshot({ path: 'e2e/__screenshots__/responsive-1280.png', fullPage: true })
  })

  test('mobile (768px): sidebar is an off-canvas drawer that opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto('/dashboard')

    const sidebar = page.locator('aside')
    const hamburger = page.getByRole('button', { name: 'Open navigation menu' })
    await expect(hamburger).toBeVisible()

    const closedBox = await sidebar.boundingBox()
    expect(closedBox?.x, 'sidebar should be translated off-screen when the drawer is closed').toBeLessThan(0)
    await page.screenshot({ path: 'e2e/__screenshots__/responsive-768-closed.png', fullPage: true })

    await hamburger.click()
    await expect.poll(async () => (await sidebar.boundingBox())?.x).toBeGreaterThanOrEqual(0)
    await page.screenshot({ path: 'e2e/__screenshots__/responsive-768-open.png', fullPage: true })

    await page.keyboard.press('Escape')
    await expect.poll(async () => (await sidebar.boundingBox())?.x).toBeLessThan(0)
  })
})
