import { test, expect, uniqueEmail } from './fixtures.js'

// No storageState here on purpose — every test in this file drives the
// actual login/register UI from a logged-out browser context, since that
// is exactly the behaviour this journey is verifying.

const DEMO_EMAIL = 'demo@autosmokeguard.local'
const DEMO_PASSWORD = 'Demo@12345'

test.describe('Authentication', () => {
  test('registering a brand-new user lands on the dashboard', async ({ page }) => {
    const email = uniqueEmail('newuser')
    await page.goto('/register')

    await page.locator('#reg-name').fill('E2E New User')
    await page.locator('#reg-email').fill(email)
    await page.locator('#reg-password').fill('Passw0rd123')
    await page.locator('#reg-confirm').fill('Passw0rd123')
    await page.getByRole('button', { name: /create account/i }).click()

    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('heading', { name: /good afternoon|good morning|good evening/i })).toBeVisible()
  })

  test('registering the same email again shows the error on the email field', async ({ page }) => {
    const email = uniqueEmail('dupe')

    // First registration succeeds.
    await page.goto('/register')
    await page.locator('#reg-name').fill('Dupe One')
    await page.locator('#reg-email').fill(email)
    await page.locator('#reg-password').fill('Passw0rd123')
    await page.locator('#reg-confirm').fill('Passw0rd123')
    await page.getByRole('button', { name: /create account/i }).click()
    await page.waitForURL('**/dashboard')

    // Second registration, same email, from a fresh visit to /register.
    await page.goto('/register')
    await page.locator('#reg-name').fill('Dupe Two')
    await page.locator('#reg-email').fill(email)
    await page.locator('#reg-password').fill('Passw0rd123')
    await page.locator('#reg-confirm').fill('Passw0rd123')
    await page.getByRole('button', { name: /create account/i }).click()

    // Must NOT navigate away, and the error must render right under the
    // email input (aria-invalid + the field-level <p>), not just a banner.
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.locator('#reg-email')).toHaveAttribute('aria-invalid', 'true')
    const emailError = page.locator('#reg-email').locator('xpath=following-sibling::p[1]')
    await expect(emailError).toContainText(/already exists/i)
  })

  test('weak password shows a field error', async ({ page }) => {
    await page.goto('/register')
    await page.locator('#reg-name').fill('Weak Password')
    await page.locator('#reg-email').fill(uniqueEmail('weakpw'))
    await page.locator('#reg-password').fill('short1')
    await page.locator('#reg-confirm').fill('short1')
    await page.getByRole('button', { name: /create account/i }).click()

    // Purely client-side — must not navigate, no network round trip needed.
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.locator('#reg-password')).toHaveAttribute('aria-invalid', 'true')
    const pwError = page.locator('#reg-password').locator('xpath=following-sibling::p[1]')
    await expect(pwError).toContainText(/at least 8 characters/i)
  })

  test('log out, log back in; wrong password shows an inline error without navigating', async ({ page }) => {
    await page.goto('/login')
    await page.screenshot({ path: 'e2e/__screenshots__/login.png', fullPage: true })
    await page.locator('#login-email').fill(DEMO_EMAIL)
    await page.locator('#login-password').fill('WrongPassword123')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText(/invalid credentials/i)).toBeVisible()

    // Now the correct password.
    await page.locator('#login-password').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/dashboard')

    // Log out via the sidebar.
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.waitForURL('**/login')
  })

  test('visiting /dashboard while logged out redirects to /login, then back to /dashboard after login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login')

    await page.locator('#login-email').fill(DEMO_EMAIL)
    await page.locator('#login-password').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    await page.waitForURL('**/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('reloading the page while logged in keeps the session (bootstrap works)', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#login-email').fill(DEMO_EMAIL)
    await page.locator('#login-password').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/dashboard')

    await page.reload()

    // Bootstrap should resolve to the same user without bouncing to /login.
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  })
})
