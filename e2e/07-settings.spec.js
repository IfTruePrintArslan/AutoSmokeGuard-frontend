import { test, expect, DEMO_AUTH, ADMIN_AUTH } from './fixtures.js'

test.describe('Settings — read-only for a regular user', () => {
  test.use({ storageState: DEMO_AUTH })

  test('the system section is read-only, with no Save button', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByText(/administrator access required/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /save changes/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^reset$/i })).toHaveCount(0)

    // Spot-check a couple of controls are actually disabled, not just visually dimmed.
    await expect(page.locator('#field-max-upload-size')).toBeDisabled()
    await expect(page.getByRole('slider', { name: 'Confidence threshold' })).toHaveAttribute('data-disabled', '')
  })
})

test.describe('Settings — admin', () => {
  test.use({ storageState: ADMIN_AUTH })

  test('can change confidence_threshold, save, and it persists across a reload', async ({ page }) => {
    await page.goto('/settings')
    await page.screenshot({ path: 'e2e/__screenshots__/settings.png', fullPage: true })

    const label = page.getByText('Confidence threshold', { exact: true })
    const row = label.locator('xpath=..')
    const valueSpan = row.locator('span.mono')
    const slider = page.getByRole('slider', { name: 'Confidence threshold' })

    const original = (await valueSpan.textContent())?.trim()
    const originalNum = Number(original)

    await slider.focus()
    const increasing = originalNum < 0.95
    await page.keyboard.press(increasing ? 'ArrowRight' : 'ArrowLeft')

    const changed = (await valueSpan.textContent())?.trim()
    expect(changed).not.toBe(original)

    const saveBtn = page.getByRole('button', { name: /save changes/i })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()
    await expect(page.getByText(/settings saved/i)).toBeVisible()

    await page.reload()
    const afterReload = (await page.getByText('Confidence threshold', { exact: true }).locator('xpath=..').locator('span.mono').textContent())?.trim()
    expect(afterReload, 'confidence_threshold should have persisted server-side').toBe(changed)

    // Restore the original value so this run doesn't leave the shared dev
    // stack's system settings mutated for whatever else is using it.
    const restoreSlider = page.getByRole('slider', { name: 'Confidence threshold' })
    await restoreSlider.focus()
    await page.keyboard.press(increasing ? 'ArrowLeft' : 'ArrowRight')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/settings saved/i)).toBeVisible()
  })

  test('severity_low_max >= severity_moderate_max shows a validation error and does not save', async ({ page }) => {
    await page.goto('/settings')

    const lowSlider = page.getByRole('slider', { name: 'Severity — low max' })
    await lowSlider.focus()
    await page.keyboard.press('End') // jump to max (1.00) — guaranteed >= moderate max

    await page.getByRole('button', { name: /save changes/i }).click()

    await expect(page.getByText(/low threshold must be less than the moderate threshold/i)).toBeVisible()
    // No save round-trip should have happened — reloading must show the
    // original (still-valid) persisted values, not 1.00.
    await page.reload()
    const lowValueAfter = (await page.getByText('Severity — low max', { exact: true }).locator('xpath=..').locator('span.mono').textContent())?.trim()
    expect(lowValueAfter).not.toBe('1.00')
  })

  test('runtime panel shows device and model metrics', async ({ page }) => {
    await page.goto('/settings')

    const runtimeCard = page.locator('.card', { hasText: 'Runtime' })
    await expect(runtimeCard).toBeVisible()

    const deviceValue = runtimeCard.getByText('Device', { exact: true }).locator('xpath=following-sibling::div[1]')
    await expect(deviceValue).toBeVisible()
    expect((await deviceValue.textContent())?.trim(), 'runtime device chip should show a real value').not.toBe('')

    const workerValue = runtimeCard.getByText('Worker threads', { exact: true }).locator('xpath=following-sibling::div[1]')
    await expect(workerValue).toBeVisible()
    expect((await workerValue.textContent())?.trim(), 'worker threads chip should show a real value').not.toBe('')
  })
})
