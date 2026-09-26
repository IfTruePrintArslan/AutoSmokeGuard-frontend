import { test, expect, DEMO_AUTH, SAMPLE, readFileHead } from './fixtures.js'

test.use({ storageState: DEMO_AUTH })

// This is the core journey: upload a real file, watch it actually upload,
// start a real analysis against the real YOLO + U-Net pipeline, watch
// progress actually advance, then verify the results render for real
// (not just that elements exist — that a broken image URL would still pass).

test.describe('Upload and analysis', () => {
  test('uploads a video, runs analysis end-to-end, and renders real results', async ({ page }) => {
    await page.goto('/upload');

    // --- Upload -------------------------------------------------------
    await page.locator('input[type="file"]').setInputFiles(SAMPLE.truckSmoking)

    // Queue row appears and shows real progress before settling as uploaded.
    const queueCard = page.locator('.card', { hasText: 'Upload queue' })
    await expect(queueCard.getByText('sample_truck_smoking.mp4')).toBeVisible()

    const startBtn = page.getByRole('button', { name: /start analysis|starting/i })
    await expect(startBtn).toBeEnabled({ timeout: 60_000 })
    await expect(queueCard.getByText('Uploaded', { exact: true })).toBeVisible()

    // Process every frame (not the default every-5th) — the real pipeline
    // finishes this short clip in ~1-2s at the default sampling rate, which
    // is faster than even a single poll cycle; sampling every frame gives
    // enough wall-clock time to actually observe progress advancing below.
    await page.locator('[aria-label="Frame sampling"]').click()
    await page.getByRole('option', { name: 'Every frame' }).click()

    // --- Start analysis -------------------------------------------------
    await startBtn.click()
    await page.waitForURL(/\/analysis\/.+/, { timeout: 30_000 })

    // --- Progress actually advances -------------------------------------
    // Note: the progress bar (and the AnalysisDetailView it lives in) is
    // NOT present the instant the URL changes — the route's lazy chunk and
    // the initial GET /api/analysis/:id both need a moment, during which a
    // loading skeleton renders instead. So "no progress bar yet" must NOT
    // be treated as "already terminal" — only the actual terminal markers
    // (the results view or the failure view) mean the run is done.
    const progressBar = page.locator('[role="progressbar"][aria-label="Analysis progress"]')
    const stageEl = page.locator('.card p').first()
    const terminalMarker = page.locator('.card-head', { hasText: 'Detections' }).or(page.getByText('Analysis failed'))

    const seenProgress = new Set()
    const seenStages = new Set()
    const deadline = Date.now() + 150_000
    let screenshotTaken = false

    while (Date.now() < deadline) {
      if (await terminalMarker.isVisible().catch(() => false)) break
      if ((await progressBar.count()) > 0) {
        const val = await progressBar.getAttribute('aria-valuenow').catch(() => null)
        if (val !== null) seenProgress.add(val)
        const stageText = (await stageEl.textContent().catch(() => null))?.trim()
        if (stageText) seenStages.add(stageText)
        if (!screenshotTaken) {
          screenshotTaken = true
          await page.screenshot({ path: 'e2e/__screenshots__/analysis-in-progress.png', fullPage: true })
        }
      }
      await page.waitForTimeout(150)
    }

    // Wait out any remaining time for a terminal state (results or failure).
    await expect(terminalMarker).toBeVisible({ timeout: 150_000 })

    const failed = await page.getByText('Analysis failed').isVisible().catch(() => false)
    expect(failed, 'Analysis pipeline reported "failed" for a known-good sample').toBe(false)

    const intermediateValues = [...seenProgress].map(Number).filter((n) => n > 0 && n < 100)
    expect(intermediateValues.length, `expected at least one intermediate progress value, saw: ${[...seenProgress].join(', ')}`).toBeGreaterThan(0)
    expect(seenStages.size, 'expected at least one non-empty stage label while running').toBeGreaterThan(0)

    // --- Results render for real -----------------------------------------
    const previewImg = page.locator('img[alt^="Annotated preview of"]')
    await expect(previewImg).toBeVisible()
    await expect
      .poll(async () => previewImg.evaluate((img) => img.naturalWidth), { timeout: 20_000 })
      .toBeGreaterThan(0)

    const statCard = (label) => page.locator('.card', { hasText: label })
    await expect(statCard('Vehicle detections')).toBeVisible()
    await expect(statCard('Smoke regions')).toBeVisible()
    await expect(statCard('Overall severity').locator('.sev')).toBeVisible()

    const detectionRows = page.locator('.card', { hasText: 'Detections' }).locator('table tbody tr')
    await expect(detectionRows).not.toHaveCount(0)

    await page.screenshot({ path: 'e2e/__screenshots__/analysis-results.png', fullPage: true })

    // --- Lightbox: open, step with arrow keys, close with Escape ---------
    await previewImg.click()
    const dialog = page.getByRole('dialog', { name: /annotated frame viewer/i })
    await expect(dialog).toBeVisible()
    const counter = dialog.locator('.mono')
    const first = await counter.textContent()
    await page.keyboard.press('ArrowRight')
    await expect(counter).not.toHaveText(first || '')
    await page.keyboard.press('ArrowLeft')
    await expect(counter).toHaveText(first || '')
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    // --- Download the PDF report ------------------------------------------
    // The hero's report control is a THREE-state machine, not two. With
    // `auto_generate_pdf` on (the default), an analysis flips to a terminal
    // status slightly before the server has finished writing the PDF, and
    // the UI deliberately shows a disabled "Preparing report…" for that
    // window rather than a misleading call to action (see
    // 09-report-truthfulness.spec.js). From there it settles into EITHER:
    //   - "Download PDF"        — the auto-generated report landed, or
    //   - "Generate PDF report" — the bounded report poll gave up, so the
    //                             manual fallback is the honest state.
    // Sampling "is Download visible?" once and irreversibly committing to
    // the manual branch races that: catch the page mid-"Preparing report…"
    // (which happens whenever the first PDF render is slow — a cold process,
    // a long video) and the control then goes straight to "Download PDF",
    // so "Generate PDF report" never renders at all and the wait for it can
    // only ever time out. Wait for it to SETTLE, then take whichever branch
    // it actually settled into.
    const downloadBtn = page.getByRole('button', { name: /download pdf/i })
    const generateBtn = page.getByRole('button', { name: /generate pdf report/i })
    await expect(downloadBtn.or(generateBtn)).toBeVisible({ timeout: 30_000 })

    if (!(await downloadBtn.isVisible().catch(() => false))) {
      // Settled on the manual fallback. A report that lands late can still
      // swap this button out from under the click — that is a success for
      // the user either way, so the click is best-effort and the assertion
      // below is what actually enforces the contract: however you get there,
      // a finished analysis must end up offering a real PDF to download.
      await generateBtn.click().catch(() => {})
      await expect(downloadBtn).toBeVisible({ timeout: 30_000 })
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click(),
    ])
    const downloadPath = await download.path()
    expect(downloadPath, 'download did not save to disk').toBeTruthy()
    const head = readFileHead(downloadPath, 5)
    expect(head.startsWith('%PDF')).toBe(true)
  })
})
