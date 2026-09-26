import { test as base, expect, request } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'

export const API_BASE = 'http://127.0.0.1:8000'
export const BASE_URL = 'http://127.0.0.1:5173'

export const SAMPLE_MEDIA_DIR = '/Users/arslan/Desktop/FYP/backend/sample_media'
export const SAMPLE = {
  truckSmoking: `${SAMPLE_MEDIA_DIR}/sample_truck_smoking.mp4`,
  carClean: `${SAMPLE_MEDIA_DIR}/sample_car_clean.mp4`,
  busSmoking: `${SAMPLE_MEDIA_DIR}/sample_bus_smoking.jpg`,
  streetClean: `${SAMPLE_MEDIA_DIR}/sample_street_clean.jpg`,
}

export const DEMO_AUTH = fileURLToPath(new URL('./.auth/demo.json', import.meta.url))
export const ADMIN_AUTH = fileURLToPath(new URL('./.auth/admin.json', import.meta.url))

// Global sink so every spec's console/network findings land in one place —
// the final report is compiled from this after the whole run completes.
export const DIAGNOSTICS = []

/**
 * A `test` extended with an autouse `page` fixture that records:
 *   - browser console errors (console.error / uncaught exceptions)
 *   - uncaught page errors (pageerror)
 *   - requests that failed at the network level (requestfailed)
 *   - HTTP responses >= 400 (annotated, not necessarily bugs — some are the
 *     deliberate negative-path assertions the journeys themselves test, e.g.
 *     wrong-password 401s or duplicate-email 400s)
 * Findings are printed to stdout (visible in --reporter=list output) and
 * pushed to the shared DIAGNOSTICS array for the final written report.
 */
export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    const record = { test: testInfo.titlePath.join(' > '), consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] }

    page.on('console', (msg) => {
      if (msg.type() === 'error') record.consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => record.pageErrors.push(String(err?.stack || err)))
    page.on('requestfailed', (req) => {
      // Aborted requests from a component unmounting mid-flight are normal
      // SPA behaviour (e.g. an upload cancelled by the user); everything
      // else is worth a look.
      const failure = req.failure()?.errorText || 'unknown'
      record.failedRequests.push(`${req.method()} ${req.url()} — ${failure}`)
    })
    page.on('response', (res) => {
      if (res.status() >= 400) {
        record.badResponses.push(`${res.request().method()} ${res.url()} — HTTP ${res.status()}`)
      }
    })

    await runTest(page)

    if (record.consoleErrors.length || record.pageErrors.length || record.failedRequests.length || record.badResponses.length) {
      DIAGNOSTICS.push(record)
      console.log(`\n[console-hygiene] ${record.test}`)
      record.consoleErrors.forEach((e) => console.log(`  console.error: ${e}`))
      record.pageErrors.forEach((e) => console.log(`  pageerror: ${e}`))
      record.failedRequests.forEach((e) => console.log(`  failed request: ${e}`))
      record.badResponses.forEach((e) => console.log(`  http >=400: ${e}`))
    }
  },
})

export { expect }

export function readFileHead(path, bytes = 8) {
  const buf = readFileSync(path)
  return buf.subarray(0, bytes).toString('latin1')
}

export function uniqueEmail(tag = 'e2e') {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.test`
}

// Registers a brand-new, uniquely-tagged user directly against the API (no
// UI round trip) and returns its tokens/user object — for specs that need a
// history/data set only THEY have ever written to, rather than asserting
// exact counts against the shared demo account (which every other spec, and
// every repeated run of the same spec, keeps adding rows to; see D30).
export async function registerTestUser(tag = 'e2e') {
  const email = uniqueEmail(tag)
  const ctx = await request.newContext({ baseURL: API_BASE })
  try {
    const res = await ctx.post('/api/register', {
      data: { full_name: `E2E ${tag}`, email, password: 'Passw0rd123' },
    })
    if (!res.ok()) {
      throw new Error(`registerTestUser: registration failed for ${email} (${res.status()}): ${await res.text()}`)
    }
    const { user, access, refresh } = await res.json()
    return { user, access, refresh, email }
  } finally {
    await ctx.dispose()
  }
}

// Logs a page in as the given `{ user, access, refresh }` identity by
// seeding the same localStorage blob tokens.js reads (mirrors what
// global-setup.js does for the two seeded demo accounts), instead of
// re-driving the login form — for specs whose identity is created ad hoc
// per-run (see `registerTestUser`) rather than pre-authenticated via
// `storageState`.
export async function loginAs(page, auth) {
  await page.goto('/login')
  await page.evaluate(({ user, access, refresh }) => {
    window.localStorage.setItem('asg_auth', JSON.stringify({ user, access, refresh }))
  }, auth)
}

function resolveAccessToken({ authFile, accessToken } = {}) {
  if (accessToken) return accessToken
  return readAccessToken(authFile || DEMO_AUTH)
}

// Reads the access token back out of a saved storageState file (the same
// blob tokens.js writes to localStorage under `asg_auth`) so specs can hit
// the API directly with `request.newContext()` for fast test-data seeding
// (e.g. "create enough rows for pagination") without re-driving the UI.
export function readAccessToken(storageStatePath) {
  const state = JSON.parse(readFileSync(storageStatePath, 'utf-8'))
  const origin = state.origins?.find((o) => o.origin === BASE_URL)
  const entry = origin?.localStorage?.find((item) => item.name === 'asg_auth')
  if (!entry) throw new Error(`No asg_auth localStorage entry found in ${storageStatePath}`)
  const parsed = JSON.parse(entry.value)
  return parsed.access
}

// Inserts a JPEG COM (comment) marker right after the SOI marker. This is a
// legal, universally-ignored segment — the resulting file is byte-for-byte
// a different upload (different hash, so the backend's upload dedup won't
// collapse it into the same media_id) while still being a perfectly valid,
// decodable JPEG with identical pixel data.
function jpegVariant(buf, tag) {
  const comment = Buffer.from(tag, 'utf-8')
  const len = comment.length + 2
  const marker = Buffer.from([0xff, 0xfe, (len >> 8) & 0xff, len & 0xff])
  return Buffer.concat([buf.subarray(0, 2), marker, comment, buf.subarray(2)])
}

// Seeds `count` extra analyses (queued/running — they do not need to finish)
// directly against the API, for tests that need "enough rows" to exercise
// pagination without waiting on `count` real end-to-end ML runs through the UI.
export async function seedQueuedAnalyses(count, { authFile = DEMO_AUTH, accessToken, tag = 'e2e-seed' } = {}) {
  const token = resolveAccessToken({ authFile, accessToken })
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  const base = readFileSync(SAMPLE.streetClean)
  const created = []
  try {
    for (let i = 0; i < count; i++) {
      const variant = jpegVariant(base, `${tag}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`)
      const uploadRes = await ctx.post('/api/upload', {
        multipart: { file: { name: `${tag}-${i}.jpg`, mimeType: 'image/jpeg', buffer: variant } },
      })
      if (!uploadRes.ok()) continue
      const media = await uploadRes.json()
      const analyzeRes = await ctx.post('/api/analyze', { data: { media_id: media.media_id } })
      if (analyzeRes.ok()) created.push(await analyzeRes.json())
    }
  } finally {
    await ctx.dispose()
  }
  return created
}

// Starts one analysis against a real video with frame_sample_rate=1 (i.e.
// every frame, not the default every-5th) so it takes long enough — a
// couple of seconds, empirically — to actually be observable as "in flight"
// by a test. A single still image finishes in well under 100ms in this
// environment, too fast for any browser-driven check to catch reliably.
export async function seedSlowVideoAnalysis({ authFile = DEMO_AUTH, accessToken, mediaPath = SAMPLE.truckSmoking, filename = 'sample_truck_smoking.mp4' } = {}) {
  const token = resolveAccessToken({ authFile, accessToken })
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  try {
    const uploadRes = await ctx.post('/api/upload', {
      multipart: { file: { name: filename, mimeType: 'video/mp4', buffer: readFileSync(mediaPath) } },
    })
    if (!uploadRes.ok()) throw new Error(`seed upload failed: ${uploadRes.status()}`)
    const media = await uploadRes.json()
    const analyzeRes = await ctx.post('/api/analyze', {
      data: { media_id: media.media_id, settings: { frame_sample_rate: 1 } },
    })
    if (!analyzeRes.ok()) throw new Error(`seed analyze failed: ${analyzeRes.status()}`)
    return await analyzeRes.json()
  } finally {
    await ctx.dispose()
  }
}

// Seeds a single analysis directly against the API with explicit `settings`,
// for tests that need deterministic control over a toggle (e.g.
// `auto_generate_pdf`) rather than relying on whatever the account's current
// system defaults happen to be. Uses a still image, which this pipeline
// finishes in well under 100ms — the fastest way to reliably reproduce the
// "terminal status lands before the report is written" race.
export async function seedAnalysisWithSettings(settings, { authFile = DEMO_AUTH, accessToken, mediaPath = SAMPLE.streetClean, filename = 'sample_street_clean.jpg', tag = 'e2e-seed' } = {}) {
  const token = resolveAccessToken({ authFile, accessToken })
  const ctx = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  try {
    const variant = jpegVariant(readFileSync(mediaPath), `${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const uploadRes = await ctx.post('/api/upload', {
      multipart: { file: { name: filename, mimeType: 'image/jpeg', buffer: variant } },
    })
    if (!uploadRes.ok()) throw new Error(`seed upload failed: ${uploadRes.status()}`)
    const media = await uploadRes.json()
    const analyzeRes = await ctx.post('/api/analyze', { data: { media_id: media.media_id, settings } })
    if (!analyzeRes.ok()) throw new Error(`seed analyze failed: ${analyzeRes.status()}`)
    return await analyzeRes.json()
  } finally {
    await ctx.dispose()
  }
}
