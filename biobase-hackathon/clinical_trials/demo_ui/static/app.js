const form = document.querySelector('#profileForm');
const resultsEl = document.querySelector('#results');
const summaryEl = document.querySelector('#summary');
const emptyEl = document.querySelector('#emptyState');
const loadingEl = document.querySelector('#loadingState');
const errorEl = document.querySelector('#errorState');
const mismatchExplanation = document.querySelector('#mismatchExplanation');
const showExcluded = document.querySelector('#showExcluded');
const template = document.querySelector('#trialTemplate');

let answersByTrial = {};
let hasSearched = false;

function setInputMode(mode) {
  const isReport = mode === 'report';
  document.querySelector('#reportInput').classList.toggle('hidden', !isReport);
  document.querySelector('#reportMode').classList.toggle('active', isReport);
  document.querySelector('#manualMode').classList.toggle('active', !isReport);
  document.querySelector('#profileDividerText').textContent = isReport ? 'Review extracted profile' : 'Enter patient profile';
}

function optionalNumber(data, name) {
  const value = data.get(name);
  return value === '' ? null : Number(value);
}

function profileFromForm() {
  const data = new FormData(form);
  const biomarkers = {};
  for (const marker of ['ER', 'PR', 'HER2']) {
    if (data.get(marker) !== 'unknown') biomarkers[marker] = data.get(marker);
  }
  const locationQuery = data.get('location_query').trim();
  const treatmentValue = data.get('treatment_naive');
  return {
    patient_reference: 'local-demo',
    primary_organ: data.get('primary_organ').trim(),
    histology: data.get('histology').trim() || null,
    age_years: optionalNumber(data, 'age_years'),
    sex: data.get('sex'),
    stage: data.get('stage').trim() || null,
    metastatic_status: data.get('metastatic_status'),
    tumor_size_mm: optionalNumber(data, 'tumor_size_mm'),
    treatment_naive: treatmentValue === 'unknown' ? null : treatmentValue === 'yes',
    biomarkers,
    location: locationQuery ? {
      query: locationQuery,
      radius_miles: Number(data.get('radius_miles'))
    } : {},
    fact_sources: {histology: 'demo_input', stage: 'demo_input', biomarkers: 'demo_input'}
  };
}

async function parseReport() {
  const status = document.querySelector('#parseStatus');
  status.className = 'parse-status';
  status.textContent = 'Parsing report…';
  try {
    const response = await fetch('/api/parse-report', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({report_text: document.querySelector('#reportText').value})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not parse report');
    applyExtractedProfile(payload.profile);
    status.classList.add('success');
    status.textContent = 'Report parsed. Review the extracted profile; exact age, overall stage, metastatic status, and treatment history may still need confirmation.';
  } catch (error) {
    status.classList.add('failure');
    status.textContent = error.message;
  }
}

function applyExtractedProfile(profile) {
  const set = (name, value) => { form.elements[name].value = value ?? ''; };
  set('primary_organ', profile.primary_organ);
  set('histology', profile.histology);
  set('age_years', profile.age_years);
  set('sex', profile.sex || 'unknown');
  const overallStage = ['Stage 0', 'Stage I', 'Stage II', 'Stage III', 'Stage IV'].includes(profile.stage) ? profile.stage : '';
  set('stage', overallStage);
  set('tumor_size_mm', profile.tumor_size_mm);
  set('metastatic_status', profile.metastatic_status || 'unknown');
  set('treatment_naive', profile.treatment_naive == null ? 'unknown' : profile.treatment_naive ? 'yes' : 'no');
  for (const marker of ['ER', 'PR', 'HER2']) set(marker, profile.biomarkers?.[marker] || 'unknown');
}

async function search() {
  hasSearched = true;
  emptyEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  summaryEl.classList.add('hidden');
  resultsEl.innerHTML = '';
  loadingEl.classList.remove('hidden');
  const data = new FormData(form);
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        profile: profileFromForm(),
        page_size: Number(data.get('page_size')),
        include_not_matches: showExcluded.checked,
        answers_by_trial: answersByTrial
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Search failed');
    render(payload);
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    loadingEl.classList.add('hidden');
  }
}

function render(payload) {
  summaryEl.innerHTML = `
    <div class="summary-item"><strong>${payload.summary.likely_relevant}</strong><span>Likely relevant</span></div>
    <div class="summary-item"><strong>${payload.summary.needs_more_information}</strong><span>Need information</span></div>
    <div class="summary-item"><strong>${payload.summary.not_a_match}</strong><span>Excluded by patient profile</span></div>`;
  summaryEl.classList.remove('hidden');
  if (payload.summary.not_a_match) {
    mismatchExplanation.textContent = showExcluded.checked
      ? `Showing ${payload.summary.not_a_match} additional result${payload.summary.not_a_match === 1 ? '' : 's'}. ClinicalTrials.gov returned these in the broad disease search, but the patient profile contradicts one or more explicit eligibility requirements.`
      : `${payload.summary.not_a_match} broad ClinicalTrials.gov result${payload.summary.not_a_match === 1 ? ' was' : 's were'} hidden because the patient profile contradicts an explicit eligibility requirement. Turn on “Show trials excluded by patient profile” to inspect why.`;
    mismatchExplanation.classList.remove('hidden');
  } else {
    mismatchExplanation.classList.add('hidden');
  }
  resultsEl.innerHTML = '';
  if (!payload.results.length) {
    resultsEl.innerHTML = '<div class="error-state">No visible trials in this result set. Turn on “Show trials excluded by patient profile” to inspect records removed by the profile checks.</div>';
    return;
  }
  for (const result of payload.results) resultsEl.append(renderTrial(result));
}

function renderTrial(result) {
  const node = template.content.firstElementChild.cloneNode(true);
  const trial = result.trial;
  node.dataset.assessment = result.assessment;
  const labels = {likely_relevant: 'Likely relevant', needs_more_information: 'Needs information', not_a_match: 'Filtered out'};
  node.querySelector('.status-pill').textContent = labels[result.assessment];
  const link = node.querySelector('.nct-link');
  link.textContent = trial.nct_id + ' ↗';
  link.href = trial.official_url;
  node.querySelector('.trial-title').textContent = trial.title;
  node.querySelector('.conditions').textContent = trial.conditions.slice(0, 5).join(' · ');
  const matched = node.querySelector('.matched-list');
  for (const text of result.matched_facts) matched.append(listItem(text));
  if (!result.matched_facts.length) matched.append(listItem('No supported facts recorded yet'));

  const questions = node.querySelector('.questions');
  for (const question of result.clarification_questions) questions.append(renderQuestion(result.nct_id, question));
  if (!result.clarification_questions.length) node.querySelector('.question-column').classList.add('hidden');

  if (result.exclusions.length) {
    const block = node.querySelector('.exclusions');
    block.classList.remove('hidden');
    for (const text of result.exclusions) block.querySelector('ul').append(listItem(text));
  }
  if (result.nearest_site) {
    const site = node.querySelector('.site-line');
    site.classList.remove('hidden');
    const locationName = [result.nearest_site.facility, result.nearest_site.city, result.nearest_site.state].filter(Boolean).join(' · ');
    site.textContent = result.distance_miles == null
      ? `Matching location: ${locationName}`
      : `Nearest site: ${locationName} · ${result.distance_miles} miles`;
  }
  node.querySelector('.criteria-details pre').textContent = trial.eligibility_text || 'No eligibility text supplied.';
  node.querySelector('.source-line').textContent = `Source: ClinicalTrials.gov · Study updated ${trial.last_update_posted || 'date unavailable'}`;
  return node;
}

function listItem(text) {
  const li = document.createElement('li');
  li.textContent = text;
  return li;
}

function renderQuestion(nctId, question) {
  const block = document.createElement('div');
  block.className = 'question';
  const prompt = document.createElement('p');
  prompt.textContent = question.prompt;
  block.append(prompt);
  const criterion = document.createElement('p');
  criterion.className = 'criterion';
  criterion.textContent = `Trial says: “${question.criterion_evidence}”`;
  block.append(criterion);
  const group = document.createElement('div');
  group.className = 'button-group';
  for (const answer of ['yes', 'no', 'unknown']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.textContent = answer[0].toUpperCase() + answer.slice(1);
    button.title = answer === 'yes' ? question.yes_effect : answer === 'no' ? question.no_effect : 'Keeps this question open.';
    if (answersByTrial[nctId]?.[question.question_id] === answer) button.classList.add('selected');
    button.addEventListener('click', () => {
      answersByTrial[nctId] ||= {};
      answersByTrial[nctId][question.question_id] = answer;
      search();
    });
    group.append(button);
  }
  block.append(group);
  return block;
}

form.addEventListener('submit', event => { event.preventDefault(); answersByTrial = {}; search(); });
document.querySelector('#parseReport').addEventListener('click', parseReport);
document.querySelector('#reportMode').addEventListener('click', () => setInputMode('report'));
document.querySelector('#manualMode').addEventListener('click', () => setInputMode('manual'));
showExcluded.addEventListener('change', () => { if (hasSearched) search(); });
document.querySelector('#resetButton').addEventListener('click', () => { form.reset(); answersByTrial = {}; showExcluded.checked = false; resultsEl.innerHTML = ''; summaryEl.classList.add('hidden'); mismatchExplanation.classList.add('hidden'); errorEl.classList.add('hidden'); emptyEl.classList.remove('hidden'); hasSearched = false; });
