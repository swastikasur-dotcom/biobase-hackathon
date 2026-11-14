import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// A real dataset report that matches at least one criterion, so the upload test is deterministic.
const reports: { id: string; text: string; matches: string[] }[] = JSON.parse(
  readFileSync(new URL('../public/data/reports.json', import.meta.url), 'utf8'),
)
const sample = reports.find((r) => r.matches.length > 0)!

test('Track 1: criterion -> cohort -> report -> CSV export', async ({ page }) => {
  await page.goto('/patients')
  await page.getByRole('link', { name: 'Browse cohorts' }).click()
  await page.getByRole('link', { name: /c03/ }).click()

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Triple-negative breast cancer')
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  expect((await download).suggestedFilename()).toBe('c03_cohort.csv')

  await rows.first().getByRole('link').click()
  await expect(page.locator('pre')).toContainText('SURGICAL PATHOLOGY REPORT')
  await expect(page.getByText(/Matches \d+ criteri/)).toBeVisible()
})

test('Track 2: low-confidence slide -> prediction -> tiles -> similar slide', async ({ page }) => {
  await page.goto('/slides')
  await page.getByLabel('Scope').selectOption('review')
  await expect(page.getByText('13 of 263')).toBeVisible()

  await page.getByRole('list').getByRole('link').first().click()
  await expect(page.getByText('Predicted organ (C1)')).toBeVisible()
  await expect(page.getByText(/review/).first()).toBeVisible()
  await expect(page.getByRole('img', { name: /20x tile 1 of slide/ })).toBeVisible()

  const similar = page.getByRole('list').filter({ has: page.getByText('#1') }).getByRole('link')
  await expect(similar).toHaveCount(10)
  const here = page.url()
  await similar.first().click()
  await expect(page).not.toHaveURL(here)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('Track 1: upload a report -> categories, evidence, similar reports, related slides', async ({ page }) => {
  await page.goto('/patients')
  await page.getByLabel('Report text').fill(sample.text)
  await page.getByRole('button', { name: 'Analyse report' }).click()

  await expect(page).toHaveURL(/\/patients\/result$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Report analysis' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Matches \d+ criteri/ })).toBeVisible()
  for (const cid of sample.matches) await expect(page.getByText(cid, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Why it matched').first()).toBeVisible()
  await expect(page.getByText('not a clinical interpretation')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Similar reports in the dataset' })).toBeVisible()

  await page.getByRole('link', { name: /^Browse .* slides$/ }).click()
  await expect(page).toHaveURL(/\/slides\?organ=/)
  await expect(page.getByLabel('Organ')).not.toHaveValue('')
})

test('Track 1: an unreadable upload shows a clear error', async ({ page }) => {
  await page.goto('/patients')
  await page.getByLabel('Report text').fill('hello world')
  await page.getByRole('button', { name: 'Analyse report' }).click()
  await expect(page.getByRole('alert')).toContainText('FINAL DIAGNOSIS')
})

test('Track 1: a .txt file can be uploaded', async ({ page }) => {
  await page.goto('/patients')
  await page.locator('input[type=file]').setInputFiles({ name: 'r.txt', mimeType: 'text/plain', buffer: Buffer.from(sample.text) })
  await expect(page.getByLabel('Report text')).toHaveValue(sample.text)
})

test('Unknown routes show a not-found page', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('Track 1: the sample button loads a held-out report that has results', async ({ page }) => {
  await page.goto('/patients')
  const button = page.getByRole('button', { name: 'Try a held-out sample report' })
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByLabel('Report text')).not.toHaveValue('')
  await page.getByRole('button', { name: 'Analyse report' }).click()
  await expect(page.getByRole('heading', { name: /^Matches [1-9]\d* criteri/ })).toBeVisible()
})

test('Result page: Edit report keeps the text, Analyse another clears it', async ({ page }) => {
  await page.goto('/patients')
  await page.getByLabel('Report text').fill(sample.text)
  await page.getByRole('button', { name: 'Analyse report' }).click()
  await expect(page).toHaveURL(/\/patients\/result$/)

  await page.getByRole('button', { name: '← Edit report' }).click()
  await expect(page).toHaveURL(/\/patients$/)
  await expect(page.getByLabel('Report text')).toHaveValue(sample.text)

  await page.getByRole('button', { name: 'Analyse report' }).click()
  await page.getByRole('button', { name: 'Analyse another report' }).click()
  await expect(page).toHaveURL(/\/patients$/)
  await expect(page.getByLabel('Report text')).toHaveValue('')
})

test('Result page: browser back returns to the input, and the result survives a reload', async ({ page }) => {
  await page.goto('/patients')
  await page.getByLabel('Report text').fill(sample.text)
  await page.getByRole('button', { name: 'Analyse report' }).click()
  await expect(page).toHaveURL(/\/patients\/result$/)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Report analysis' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/patients$/)
})

test('Result page opened directly redirects to the input', async ({ page }) => {
  await page.goto('/patients/result')
  await expect(page).toHaveURL(/\/patients$/)
  await expect(page.getByRole('heading', { name: 'Analyse a pathology report' })).toBeVisible()
})

const slideFile = { name: 'my-slide.svs', mimeType: 'application/octet-stream', buffer: Buffer.from('not a real slide') }

test('Slide upload card (demo): file -> labelled demo result with prediction and 10 similar slides', async ({ page }) => {
  await page.goto('/slides')
  await expect(page.getByRole('heading', { name: 'Analyse a slide' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Analyse a slide' })).toHaveCount(0) // no separate page or nav item

  const analyse = page.getByRole('button', { name: 'Analyse slide' })
  await expect(analyse).toBeDisabled()
  await page.locator('input[type=file]').setInputFiles(slideFile)
  await expect(page.getByText('my-slide.svs')).toBeVisible()
  await analyse.click()

  await expect(page).toHaveURL(/\/slides\/analysis$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Slide analysis' })).toBeVisible()
  await expect(page.getByText('Predicted organ (C1)')).toBeVisible()
  const similar = page.getByRole('list').filter({ has: page.getByText('#1') }).getByRole('link')
  await expect(similar).toHaveCount(10)
})

test('Slide analysis (demo): another random slide changes the result, and back returns to the card', async ({ page }) => {
  await page.goto('/slides')
  await page.locator('input[type=file]').setInputFiles(slideFile)
  await page.getByRole('button', { name: 'Analyse slide' }).click()
  const fullPage = page.getByRole('link', { name: /Open the full slide page/ })
  const before = await fullPage.getAttribute('href')

  await page.getByRole('button', { name: 'Show another random slide' }).click()
  await expect(fullPage).not.toHaveAttribute('href', before!)

  await page.getByRole('button', { name: '← Back to slides' }).click()
  await expect(page).toHaveURL(/\/slides$/)
  await expect(page.getByRole('heading', { name: 'Analyse a slide' })).toBeVisible()
})

test('Slide analysis opened directly redirects to the slide browser', async ({ page }) => {
  await page.goto('/slides/analysis')
  await expect(page).toHaveURL(/\/slides$/)
})

test('Select test case: goes straight to a held-out slide analysis with no file', async ({ page }) => {
  await page.goto('/slides')
  const link = page.getByRole('button', { name: 'Select test case' })
  await expect(link).toBeEnabled() // no file needed
  await link.click()

  await expect(page).toHaveURL(/\/slides\/analysis$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Slide analysis' })).toBeVisible()
  await expect(page.getByText('Predicted organ (C1)')).toBeVisible()
  const similar = page.getByRole('list').filter({ has: page.getByText('#1') }).getByRole('link')
  await expect(similar).toHaveCount(10)

  const fullPage = page.getByRole('link', { name: /Open the full slide page/ })
  const before = await fullPage.getAttribute('href')
  await page.getByRole('button', { name: 'Show another random slide' }).click()
  await expect(fullPage).not.toHaveAttribute('href', before!)
})

test('Motion: pages animate in and cards lift on hover', async ({ page }) => {
  await page.goto('/slides')
  await expect(page.locator('.page-enter')).toHaveCSS('animation-duration', '0.3s')

  const card = page.locator('a.lift').first()
  await expect(card).toBeVisible()
  await card.hover()
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none')

  // Moving to another page re-runs the entrance animation on a fresh wrapper.
  await page.getByRole('link', { name: 'About the data' }).click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.locator('.page-enter')).toHaveCSS('animation-duration', '0.3s')
})

test('Motion: reduced-motion preference switches animation off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/slides')
  const seconds = await page.locator('.page-enter').evaluate((el) => parseFloat(getComputedStyle(el).animationDuration))
  expect(seconds).toBeLessThan(0.001)
  const transition = await page.getByRole('button', { name: 'Select test case' }).evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))
  expect(transition).toBeLessThan(0.001)
})

test('Slide map: hovering a dot shows a card with the image and basic info', async ({ page }) => {
  await page.goto('/slides/map')
  const dots = page.locator('svg g[role=link]')
  await expect(dots).toHaveCount(261) // slides with a GigaPath embedding

  await dots.nth(40).hover({ force: true })
  const card = page.getByText('Click to open', { exact: true })
  await expect(card).toBeVisible()
  await expect(page.locator('img[alt=""]').first()).toBeVisible() // thumbnail inside the card
  await expect(page.getByText('Supplier', { exact: true })).toBeVisible()

  await page.mouse.move(2, 2)
  await expect(card).toBeHidden()

  // keyboard: focusing a dot shows the card too
  await dots.nth(10).focus()
  await expect(card).toBeVisible()
})

test('Similar slides map: other slides are greyed and the ten closest are highlighted', async ({ page }) => {
  await page.goto('/slides')
  await page.getByRole('button', { name: 'Select test case' }).click()
  await page.getByRole('link', { name: /Open the full slide page/ }).click()
  await expect(page.getByRole('heading', { name: /Most similar slides/ })).toBeVisible()

  const map = page.getByRole('group', { name: /Map of slides/ })
  await expect(map).toBeVisible()
  await expect(page.getByText('all other slides')).toBeVisible()
  await expect(page.getByText('ten most similar (numbered)')).toBeVisible()

  // Numbered dots for the similar slides (a slide without an embedding is not drawn).
  const numbered = map.locator('text')
  expect(await numbered.count()).toBeGreaterThanOrEqual(9)
  expect(await numbered.count()).toBeLessThanOrEqual(10)

  // Everything else is the grey colour.
  const greyDots = await map.locator('g[role=link] circle[fill="#cbd5e1"]').count()
  expect(greyDots).toBeGreaterThan(200)

  // Hovering a card in the grid emphasises its dot on the map.
  await page.locator('ol a').first().hover()
  await expect(map.locator('g[aria-label$="similar slide 1"] circle').last()).toHaveAttribute('stroke', '#1d4ed8')
})

test('Analysis page shows the same highlighted map', async ({ page }) => {
  await page.goto('/slides')
  await page.getByRole('button', { name: 'Select test case' }).click()
  await expect(page.getByRole('group', { name: /Map of slides/ })).toBeVisible()
  await expect(page.getByText('all other slides')).toBeVisible()
})

test('Paperclip: slide page button opens the stored literature results for its organ', async ({ page }) => {
  await page.goto('/slides/SUPP-02-bb_02_wsi_0176') // predicted Prostate
  await page.getByRole('button', { name: 'Paperclip' }).click()

  const panel = page.getByRole('dialog', { name: /Paperclip results: Prostate/ })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('tab', { name: /H&E micrographs\s*11/ })).toBeVisible()
  await expect(panel.getByRole('tab', { name: /Biomarkers\s*6/ })).toBeVisible()
  await expect(panel.getByText('not a live query')).toBeVisible()

  // The 11 micrographs are real, loaded images.
  const images = panel.locator('ul img')
  await expect(images).toHaveCount(11)
  await expect.poll(() => images.first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)

  // Opening one shows its details and a link to the source paper.
  await panel.locator('ul button').first().click()
  await expect(panel.getByRole('button', { name: '← All micrographs' })).toBeVisible()
  await expect(panel.getByRole('link', { name: /↗/ })).toHaveAttribute('href', /^https:\/\//)
  await panel.getByRole('button', { name: '← All micrographs' }).click()

  await panel.getByRole('tab', { name: /Biomarkers/ }).click()
  await expect(panel.getByText('Evidence from the paper').first()).toBeVisible()
  await panel.getByRole('tab', { name: /Biobase slides/ }).click()
  await expect(panel.getByText('Labelled slides')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
})

test('Paperclip: slide browser button needs an organ, and says when nothing was found', async ({ page }) => {
  await page.goto('/slides')
  const button = page.getByRole('button', { name: 'Paperclip' })
  await expect(button).toBeDisabled()

  await page.getByLabel('Organ').selectOption('Esophagus')
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByText('The search found no H&E tumour micrographs for Esophagus.')).toBeVisible()
  await page.getByRole('button', { name: 'Close Paperclip results' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByLabel('Organ').selectOption('Breast')
  await button.click()
  await expect(page.getByRole('tab', { name: /H&E micrographs\s*14/ })).toBeVisible()
})

test('Paperclip: also on the slide analysis page', async ({ page }) => {
  await page.goto('/slides')
  await page.getByRole('button', { name: 'Select test case' }).click()
  await page.getByRole('button', { name: 'Paperclip' }).click()
  await expect(page.getByRole('dialog', { name: /Paperclip results:/ })).toBeVisible()
})
