import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// The example report the trial page opens with: a synthetic, triple-negative breast report.
const reports: { id: string; text: string }[] = JSON.parse(readFileSync(new URL('../public/data/reports.json', import.meta.url), 'utf8'))
const byId = (id: string) => reports.find((r) => r.id === id)!
const example = byId('SYN-acf232aae2')
// The order the trial page cycles its examples in.
const examples = ['SYN-acf232aae2', 'SYN-8c2ca12cb1', 'SYN-aca9f74c6c', 'SYN-1d410fa50c', 'SYN-3156efff9b'].map(byId)

test('Track 1: criterion -> cohort -> report -> CSV export', async ({ page }) => {
  await page.goto('/patients')
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

test('Unknown routes show a not-found page', async ({ page }) => {
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

const slideFile = { name: 'my-slide.svs', mimeType: 'application/octet-stream', buffer: Buffer.from('not a real slide') }

// The upload button is disabled until the slide data has loaded, so wait for it before choosing a file.
async function pickSlideFile(page: Page) {
  const input = page.locator('input[type=file]')
  await expect(input).toBeEnabled()
  await input.setInputFiles(slideFile)
}

test('Slide upload card (demo): file -> labelled demo result with prediction and 10 similar slides', async ({ page }) => {
  await page.goto('/slides')
  await expect(page.getByText('Analyse a slide', { exact: true })).toBeVisible() // one-line button, no separate page or nav item
  await expect(page.getByRole('link', { name: 'Analyse a slide' })).toHaveCount(0)

  await pickSlideFile(page) // choosing a file runs the demo analysis

  await expect(page).toHaveURL(/\/slides\/analysis$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Slide analysis' })).toBeVisible()
  await expect(page.getByText('Predicted organ (C1)')).toBeVisible()
  const similar = page.getByRole('list').filter({ has: page.getByText('#1') }).getByRole('link')
  await expect(similar).toHaveCount(10)
})

test('Slide analysis (demo): another random slide changes the result, and back returns to the card', async ({ page }) => {
  await page.goto('/slides')
  await pickSlideFile(page)
  const fullPage = page.getByRole('link', { name: /Open the full slide page/ })
  const before = await fullPage.getAttribute('href')

  await page.getByRole('button', { name: 'Show another random slide' }).click()
  await expect(fullPage).not.toHaveAttribute('href', before!)

  await page.getByRole('button', { name: '← Back to slides' }).click()
  await expect(page).toHaveURL(/\/slides$/)
  await expect(page.getByText('Analyse a slide', { exact: true })).toBeVisible()
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
  await expect(page.locator('dt', { hasText: 'Supplier' })).toBeVisible()

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

test('Find patients is the cohort browser, and Find trials is its own tab', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main' })
  await page.goto('/patients')
  await expect(page.getByRole('heading', { level: 1, name: 'Browse cohorts' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Find trials for a patient' })).toHaveCount(0) // no longer a button here
  await expect(nav.getByRole('link', { name: 'Find patients' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Find trials', exact: true })).not.toHaveAttribute('aria-current', 'page')

  await nav.getByRole('link', { name: 'Find trials', exact: true }).click()
  await expect(page).toHaveURL(/\/patients\/match$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Find trials worth reviewing' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Find trials', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Find patients' })).not.toHaveAttribute('aria-current', 'page')

  // Cohort pages still belong to Find patients.
  await page.goto('/patients/c03')
  await expect(nav.getByRole('link', { name: 'Find patients' })).toHaveAttribute('aria-current', 'page')
  await page.goto('/patients/browse')
  await expect(page).toHaveURL(/\/patients$/)
})

test('Jev: cohort table shows Jev probabilities and flags low-scoring matches for review', async ({ page }) => {
  await page.goto('/patients/c30')
  await expect(page.getByRole('columnheader', { name: 'Jev' })).toBeVisible()
  await expect(page.getByText('5 to review (Jev under 50%)')).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: 'review' })).toHaveCount(5)

  // Lowest Jev first puts a flagged report at the top.
  await page.getByLabel('Lowest Jev score first').check()
  await expect(page.locator('tbody tr').first()).toContainText('review')

  // The report page shows the score next to each matched criterion.
  await page.locator('tbody tr').first().getByRole('link').click()
  await expect(page.getByText('Matches 1 criterion')).toBeVisible()
  await expect(page.locator('aside').getByText(/· review/)).toBeVisible()
})

test('About the models: nav button opens a modal with one tab per task, Escape closes it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'About the models' }).click()
  const modal = page.getByRole('dialog', { name: 'About the models' })
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('tab')).toHaveCount(3)

  // Task A is open first.
  await expect(modal.getByRole('tab', { name: /Task A/ })).toHaveAttribute('aria-selected', 'true')
  await expect(modal.getByRole('img', { name: /read by rules and by Jev/ })).toBeVisible()
  await expect(modal.getByRole('img', { name: 'Whole slide' })).toHaveCount(0)

  await modal.getByRole('tab', { name: /Task C1/ }).click()
  await expect(modal.getByRole('img', { name: /GigaPath embedding/ })).toBeVisible()
  await expect.poll(() => modal.getByRole('img', { name: 'Whole slide' }).evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)

  await modal.getByRole('tab', { name: /Task C2/ }).click()
  await expect(modal.getByRole('img', { name: /predicted organ are ranked first/ })).toBeVisible()
  await expect(modal.getByText('Precision@10: 0.83')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await page.getByRole('button', { name: 'About the models' }).click()
  await page.getByRole('button', { name: 'Close About the models' }).click()
  await expect(modal).toBeHidden()
})


// ---------- Trial matching (ClinicalTrials.gov calls are mocked: no live network in tests) ----------

const trial = (nct: string, title: string) => ({
  nct_id: nct, title, status: 'RECRUITING', conditions: ['Breast Cancer'], interventions: [], locations: [],
  official_url: `https://clinicaltrials.gov/study/${nct}`, eligibility_text: 'Inclusion Criteria:\n- Breast cancer', last_update_posted: '2026-01-02',
})
const match = (nct: string, title: string, assessment: string, extra = {}) => ({
  nct_id: nct, status: 'RECRUITING', assessment, matched_facts: ['condition mentions breast', 'HER2 is negative'], exclusions: [],
  unknown_requirements: [], clarification_questions: [], nearest_site: null, distance_miles: null, location_status: null,
  source_url: `https://clinicaltrials.gov/study/${nct}`, source_last_updated: null, review_note: 'Likely relevance only.', trial: trial(nct, title), ...extra,
})
const searchBody = (results: unknown[], summary = { likely_relevant: 1, needs_more_information: 1, not_a_match: 1 }) => ({
  summary, results, not_matches_hidden: true, disclaimer: 'Pre-screening only; the study team must confirm eligibility.',
  profile: { primary_organ: 'breast', biomarkers: {}, pathology_facts: {}, location: {} }, search_term: 'breast invasive ductal carcinoma',
})
const question = {
  question_id: 'has_metastatic_disease', prompt: 'Does the patient have metastatic disease?', criterion_evidence: 'Metastatic breast cancer',
  yes_effect: 'Excluded.', no_effect: 'Stays on the shortlist.',
}

test('Find trials: opens on the example, reads it into a profile locally, then searches the registry', async ({ page }) => {
  const searches: any[] = []
  await page.route('**/api/trials/search', async (route) => {
    const body = route.request().postDataJSON()
    searches.push(body)
    const answered = body.answers_by_trial?.NCT00000002?.has_metastatic_disease === 'no'
    await route.fulfill({
      json: searchBody(
        [
          match('NCT00000001', 'Adjuvant therapy in early breast cancer', 'likely_relevant'),
          match('NCT00000002', 'Study needing one answer', answered ? 'likely_relevant' : 'needs_more_information', answered ? {} : { clarification_questions: [question] }),
          ...(body.include_not_matches ? [match('NCT00000003', 'A metastatic-only study', 'not_a_match', { matched_facts: [], exclusions: ['requires metastatic disease'] })] : []),
        ],
        { likely_relevant: answered ? 2 : 1, needs_more_information: answered ? 0 : 1, not_a_match: 1 },
      ),
    })
  })

  await page.goto('/patients')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Find trials', exact: true }).click()
  await expect(page).toHaveURL(/\/patients\/match$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Find trials worth reviewing' })).toBeVisible()
  await expect(page.getByLabel('Pathology report')).toHaveValue(example.text)

  // The report is read locally into an editable profile (real backend, no registry call yet).
  await expect(page.getByLabel('Primary organ')).toHaveValue('breast')
  await expect(page.getByLabel('Sex')).toHaveValue('female')
  await expect(page.getByLabel('ER', { exact: true })).toHaveValue('negative')
  await expect(page.getByLabel('HER2')).toHaveValue('negative')
  await expect(page.getByLabel('Age (years)')).toHaveValue('62') // the report only gives 60-69
  expect(searches).toHaveLength(0)

  await page.getByRole('button', { name: 'Find trials', exact: true }).first().click()
  await expect(page.getByText('Searched ClinicalTrials.gov for open studies of “breast invasive ductal carcinoma”.')).toBeVisible()
  expect(searches).toHaveLength(1)
  // Privacy: the report text never goes to the search endpoint, only the de-identified profile.
  expect(JSON.stringify(searches[0])).not.toContain('SURGICAL PATHOLOGY REPORT')
  expect(searches[0].profile).toMatchObject({ primary_organ: 'breast', age_years: 62, sex: 'female', biomarkers: { ER: 'negative', PR: 'negative', HER2: 'negative' } })

  await expect(page.getByText('5 broad', { exact: false })).toHaveCount(0)
  await expect(page.getByText('1 broad ClinicalTrials.gov result was hidden')).toBeVisible()
  const card = page.getByRole('article', { name: 'Trial NCT00000001' })
  await expect(card.getByText('Likely relevant')).toBeVisible()
  await expect(card.getByText('HER2 is negative')).toBeVisible()
  await expect(card.getByRole('link', { name: /NCT00000001/ })).toHaveAttribute('href', 'https://clinicaltrials.gov/study/NCT00000001')

  // A clarification question: answering it re-ranks the trial.
  const second = page.getByRole('article', { name: 'Trial NCT00000002' })
  await expect(second.getByText('Needs information')).toBeVisible()
  await second.getByRole('button', { name: 'No', exact: true }).click()
  await expect(second.getByText('Likely relevant')).toBeVisible()
  expect(searches.at(-1).answers_by_trial).toEqual({ NCT00000002: { has_metastatic_disease: 'no' } })

  // Excluded trials are hidden until asked for, then explain why.
  await expect(page.getByRole('article', { name: 'Trial NCT00000003' })).toHaveCount(0)
  await page.getByLabel('Show trials excluded by patient profile').check()
  const excluded = page.getByRole('article', { name: 'Trial NCT00000003' })
  await expect(excluded.getByText('Excluded by profile')).toBeVisible()
  await expect(excluded.getByText('requires metastatic disease')).toBeVisible()
  expect(searches.at(-1).include_not_matches).toBe(true)
})

test('Find trials: a registry failure shows a clear error, and an empty search says so', async ({ page }) => {
  await page.route('**/api/trials/search', (route) => route.fulfill({ status: 502, json: { detail: 'ClinicalTrials.gov request failed: timed out' } }))
  await page.goto('/patients/match')
  await expect(page.getByLabel('Primary organ')).toHaveValue('breast')
  await page.getByRole('button', { name: 'Find trials', exact: true }).first().click()
  await expect(page.getByRole('alert')).toContainText('ClinicalTrials.gov request failed')

  await page.unroute('**/api/trials/search')
  await page.route('**/api/trials/search', (route) => route.fulfill({ json: searchBody([], { likely_relevant: 0, needs_more_information: 0, not_a_match: 0 }) }))
  await page.getByRole('button', { name: 'Find trials', exact: true }).first().click()
  await expect(page.getByText('No open trials were found for “breast invasive ductal carcinoma”. Try a broader histology.')).toBeVisible()
})

test('Find trials: public sources are optional, and say so when the provider is not installed', async ({ page }) => {
  await page.route('**/api/trials/search', (route) => route.fulfill({ json: searchBody([match('NCT00000001', 'Adjuvant therapy', 'likely_relevant')]) }))
  await page.route('**/api/trials/research', (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ nct_id: 'NCT00000001' })
    return route.fulfill({ status: 503, json: { detail: "Public-source research needs the 'keenable' package." } })
  })
  await page.goto('/patients/match')
  await expect(page.getByLabel('Primary organ')).toHaveValue('breast')
  await page.getByRole('button', { name: 'Find trials', exact: true }).first().click()
  await page.getByRole('button', { name: 'Find public sources' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'keenable' })).toBeVisible()
})

test('Find trials: manual entry works without a report, and bad values are caught before any search', async ({ page }) => {
  let searched = false
  await page.route('**/api/trials/search', (route) => {
    searched = true
    return route.fulfill({ json: searchBody([]) })
  })
  await page.goto('/patients/match')
  await page.getByRole('tab', { name: 'Enter facts manually' }).click()
  await expect(page.getByLabel('Pathology report')).toHaveCount(0)

  await page.getByLabel('Primary organ').fill('')
  await expect(page.getByRole('button', { name: 'Find trials', exact: true }).first()).toBeDisabled()
  await page.getByLabel('Primary organ').fill('lung')
  await page.getByLabel('Age (years)').fill('200')
  await page.getByRole('button', { name: 'Find trials', exact: true }).first().click()
  await expect(page.getByRole('alert')).toContainText('Age must be a whole number from 0 to 130')
  expect(searched).toBe(false)
})

test('Browse cohorts: Analyse a report runs the rules and Jev and summarises both', async ({ page }) => {
  await page.route('**/api/analyze', (route) =>
    route.fulfill({
      json: {
        organ: 'breast',
        fields: { organ: 'breast', sex: 'F' },
        matches: [{ id: 'C01', text: 'Triple-negative breast cancer', evidence: [{ field: 'ER', value: 'negative' }] }],
        not_matched: [],
        summary: 'Breast report for a female patient.',
        warnings: [],
        jev: { C01: 0.93, C02: 0.71 },
        jev_error: null,
      },
    }),
  )
  await page.goto('/patients')
  await page.getByRole('link', { name: 'Analyse a report' }).click()
  await expect(page).toHaveURL(/\/patients\/analyze$/)
  await page.getByLabel('Report text').fill('FINAL DIAGNOSIS: breast, triple negative')
  await page.getByRole('button', { name: 'Analyse report' }).click()
  await expect(page).toHaveURL(/\/patients\/result$/)
  await expect(page.getByText('Jev says yes to 2 criteria; 1 of them also match the rules')).toBeVisible()
  await expect(page.getByText('93%').first()).toBeVisible()
  await expect(page.getByText('rules do not match')).toBeVisible()
})

test('Analyse a report: if Jev is unavailable the rule results still show', async ({ page }) => {
  await page.route('**/api/analyze', (route) =>
    route.fulfill({
      json: { organ: 'breast', fields: {}, matches: [], not_matched: [], summary: 'S.', warnings: [], jev: null, jev_error: 'Jev is not configured: set JEV_API_KEY.' },
    }),
  )
  await page.goto('/patients/analyze')
  await page.getByLabel('Report text').fill('FINAL DIAGNOSIS: x')
  await page.getByRole('button', { name: 'Analyse report' }).click()
  await expect(page.getByText('Jev is not configured')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible()
})

test('Find trials: the blue link cycles through the example reports and reloads the profile each time', async ({ page }) => {
  await page.goto('/patients/match')
  const report = page.getByLabel('Pathology report')
  const link = page.getByRole('button', { name: 'Next example →' })
  await expect(report).toHaveValue(examples[0].text)
  await expect(link).toHaveClass(/text-blue-700/) // a blue, underlined link
  await expect(link).toHaveCSS('text-decoration-line', 'underline')

  const organs = ['breast', 'breast', 'colon', 'lung', 'kidney']
  for (let i = 1; i < 5; i++) {
    await link.click()
    await expect(report).toHaveValue(examples[i].text)
    await expect(page.getByLabel('Primary organ')).toHaveValue(organs[i])
    await expect(page.getByLabel('Age (years)')).not.toHaveValue('') // an example age inside the report's band
  }
  await link.click() // wraps around to the first example
  await expect(report).toHaveValue(examples[0].text)

  // With your own text in the box, the link offers an example instead of skipping one.
  await report.fill('my own report')
  await expect(page.getByRole('button', { name: 'Load an example →' })).toBeVisible()
  await page.getByRole('button', { name: 'Load an example →' }).click()
  await expect(report).toHaveValue(examples[0].text)
})

// ---------- Slide map: filters ----------

test('Slide map: the map fits the screen and the page is built around filters', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/slides/map')
  const filters = page.getByRole('complementary', { name: 'Map filters' })
  await expect(filters).toBeVisible()
  await expect(page.getByText('261 slides', { exact: true })).toBeVisible()
  await expect(page.locator('svg g[role=link]')).toHaveCount(261)

  // The map no longer dominates: it fits within the viewport height, with the filters beside it.
  const map = await page.getByRole('group', { name: /Map of slides/ }).boundingBox()
  expect(map!.height).toBeLessThanOrEqual(800 * 0.75)
  expect(map!.x).toBeGreaterThan((await filters.boundingBox())!.x + (await filters.boundingBox())!.width - 1)
})

test('Slide map: filter by organ fades the rest, updates the counts and the list, and survives a reload', async ({ page }) => {
  await page.goto('/slides/map')
  const kidney = page.getByRole('checkbox', { name: /Kidney/ })
  const n = Number((await page.getByText(/^Kidney\s*\d+$/).first().innerText()).match(/\d+$/)![0]) // the chip's count
  expect(n).toBeGreaterThan(0)

  await kidney.check()
  await expect(page.getByText(`Showing ${n} of 261 slides`)).toBeVisible()
  await expect(page.locator('svg g[role=link]')).toHaveCount(n) // every other dot is faded and no longer a link
  await expect(page.locator('svg g[aria-hidden=true]')).toHaveCount(261 - n)
  await expect(page).toHaveURL(/organs=Kidney/)
  await expect(page.getByText('faded = filtered out')).toBeVisible()
  const listed = page.getByRole('region', { name: 'Slides in view' }).getByRole('link')
  expect(await listed.count()).toBe(Math.min(n, 12))

  await page.reload()
  await expect(page.getByRole('checkbox', { name: /Kidney/ })).toBeChecked()
  await expect(page.getByText(`Showing ${n} of 261 slides`)).toBeVisible()

  await page.getByRole('button', { name: 'Reset filters' }).click()
  await expect(page.getByText('261 slides', { exact: true })).toBeVisible()
  await expect(page.locator('svg g[role=link]')).toHaveCount(261)
})

test('Slide map: Needs review shows the 13 low-confidence predictions, and the list opens a slide', async ({ page }) => {
  await page.goto('/slides/map')
  await page.getByRole('button', { name: 'Needs review' }).click()
  await expect(page.getByText('Showing 13 of 261 slides')).toBeVisible()
  await expect(page.locator('svg g[role=link]')).toHaveCount(13)

  // Least confident first, each with its confidence badge.
  const first = page.getByRole('region', { name: 'Slides in view' }).getByRole('link').first()
  await expect(first).toContainText('review')
  await first.click()
  await expect(page.getByText('Predicted organ (C1)')).toBeVisible()
})

test('Slide map: search, supplier and stain filters combine, and an empty result says so', async ({ page }) => {
  await page.goto('/slides/map')
  await page.getByLabel('Find a slide').fill('0176')
  await expect(page.getByText('Showing 1 of 261 slides')).toBeVisible()

  await page.getByLabel('Find a slide').fill('')
  await page.getByLabel('Supplier').selectOption('SUPP-01')
  const supplier = Number((await page.getByText(/^Showing \d+ of 261 slides$/).innerText()).match(/Showing (\d+)/)![1])
  expect(supplier).toBeGreaterThan(0)
  expect(supplier).toBeLessThan(261)

  await page.getByLabel('Find a slide').fill('zzzz-nothing')
  await expect(page.getByText('Showing 0 of 261 slides')).toBeVisible()
  await expect(page.getByText('No slides match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Reset filters' }).last().click()
  await expect(page.getByText('261 slides', { exact: true })).toBeVisible()
})

test('Slide map: hovering a slide in the list highlights its dot on the map', async ({ page }) => {
  await page.goto('/slides/map')
  const item = page.getByRole('region', { name: 'Slides in view' }).getByRole('link').first()
  await item.hover()
  await expect(page.locator('svg circle[stroke="#1d4ed8"]')).toHaveCount(1)
})
