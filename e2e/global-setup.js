import { chromium, request } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Pre-authenticates the two seeded users once, up front, and saves each
// session's storageState (cookies + localStorage, which is where the app's
// tokens.js keeps the `asg_auth` blob) to disk. Specs that need to start
// already logged in use `test.use({ storageState: '<path>' })` instead of
// re-driving the login form every time — the auth spec itself is the one
// place that actually exercises the login/register UI.

const API_BASE = 'http://127.0.0.1:8000'
const BASE_URL = 'http://127.0.0.1:5173'
const AUTH_DIR = new URL('./.auth/', import.meta.url)

async function saveSession(email, password, filename) {
  const apiCtx = await request.newContext()
  const res = await apiCtx.post(`${API_BASE}/api/login`, { data: { email, password } })
  if (!res.ok()) {
    const body = await res.text()
    await apiCtx.dispose()
    throw new Error(`global-setup: login failed for ${email} (${res.status()}): ${body}`)
  }
  const { user, access, refresh } = await res.json()
  await apiCtx.dispose()

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.evaluate(
    ({ user, access, refresh }) => {
      window.localStorage.setItem('asg_auth', JSON.stringify({ user, access, refresh }))
    },
    { user, access, refresh }
  )
  await page.context().storageState({ path: fileURLToPath(new URL(filename, AUTH_DIR)) })
  await browser.close()
}

export default async function globalSetup() {
  mkdirSync(fileURLToPath(AUTH_DIR), { recursive: true })
  await saveSession('demo@autosmokeguard.local', 'Demo@12345', 'demo.json')
  await saveSession('admin@autosmokeguard.local', 'Admin@12345', 'admin.json')
}
