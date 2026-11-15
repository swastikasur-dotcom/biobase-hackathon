import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import TrialCard from '../components/TrialCard'
import TrialRow from '../components/TrialRow'
import { useReports } from '../data/api'
import { profileFromReport, searchTrials } from '../data/trials'
import { emptyForm, formFromProfile, profileFromForm, type ProfileForm } from '../lib/trialForm'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useDraft } from '../state/draft'
import type { Answer, TrialAnswers, TrialAssessment, TrialProfile } from '../types'

const MAX_BYTES = 200_000

/** Synthetic example reports the page can cycle through, each checked to return open trials. Reports give an age band, not an age. */
const EXAMPLES = [
  { id: 'SYN-acf232aae2', label: 'Breast · triple-negative ductal' },
  { id: 'SYN-8c2ca12cb1', label: 'Breast · lobular' },
  { id: 'SYN-aca9f74c6c', label: 'Colon · adenocarcinoma' },
  { id: 'SYN-1d410fa50c', label: 'Lung · squamous cell' },
  { id: 'SYN-3156efff9b', label: 'Kidney · clear cell' },
]

/** An example age inside the report's band ("60-69" -> 62), so the example can be searched. Real reports are left blank. */
const exampleAge = (band: string | undefined) => (band && /^\d+/.test(band) ? String(parseInt(band, 10) + 2) : '')

const input = 'w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm'
const label = 'mb-1 block text-xs font-medium text-slate-600'

function Field({ id, text, children }: { id: string; text: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children}
    </div>
  )
}

const Marker = ({ id, text, value, onChange }: { id: string; text: string; value: string; onChange: (v: string) => void }) => (
  <Field id={id} text={text}>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">Unknown</option>
      <option value="positive">Positive</option>
      <option value="negative">Negative</option>
    </select>
  </Field>
)

const FILTERS: { key: 'all' | TrialAssessment; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'likely_relevant', label: 'Likely relevant' },
  { key: 'needs_more_information', label: 'Needs information' },
  { key: 'not_a_match', label: 'Excluded' },
]

export default function TrialMatch() {
  useDocumentTitle('Find trials')
  const reports = useReports()
  const { text, setText, seeded, setSeeded } = useDraft()
  const examples = EXAMPLES.flatMap((e) => {
    const r = reports.data?.find((x) => x.id === e.id)
    return r ? [{ ...e, text: r.text }] : []
  })
  const example = examples[0]
  const exampleIndex = examples.findIndex((e) => e.text === text)

  const [mode, setMode] = useState<'report' | 'manual'>('report')
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [base, setBase] = useState<TrialProfile | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [formError, setFormError] = useState('')
  const [fileError, setFileError] = useState('')
  const [answers, setAnswers] = useState<TrialAnswers>({})
  const [includeExcluded, setIncludeExcluded] = useState(false)
  const [filter, setFilter] = useState<'all' | TrialAssessment>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  // The example is read automatically when the page opens. If the user has already started editing the form by the
  // time that finishes, their edits win.
  const autoReading = useRef(false)
  const edited = useRef(false)

  const read = useMutation({
    mutationFn: profileFromReport,
    onSuccess: ({ profile, review_note }, reportText) => {
      const wasAuto = autoReading.current
      autoReading.current = false
      if (wasAuto && edited.current) return
      edited.current = false
      const f = formFromProfile(profile)
      // The report only gives an age band, so an example carries an example age; real reports are left blank.
      if (!f.age && examples.some((e) => e.text === reportText)) f.age = exampleAge(profile.pathology_facts?.age_band)
      setForm(f)
      setBase(profile)
      setReviewNote(review_note)
      setFormError('')
      setAnswers({})
      search.reset()
    },
  })

  const search = useMutation({ mutationFn: searchTrials })

  // First visit: load the example report and read it into the profile (local only). Nothing is sent to the
  // registry until the user presses "Find trials".
  useEffect(() => {
    if (!example || seeded) return
    setText((current) => (current === '' ? example.text : current))
    setSeeded(true)
  }, [example, seeded, setText, setSeeded])

  const autoRead = useRef(false)
  useEffect(() => {
    if (!autoRead.current && seeded && text.trim()) {
      autoRead.current = true
      autoReading.current = true
      read.mutate(text)
    }
  }, [seeded, text, read])

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    edited.current = true
    setForm((f) => ({ ...f, [key]: value }))
  }

  function run(opts: { answers?: TrialAnswers; includeExcluded?: boolean } = {}) {
    const built = profileFromForm(form, base)
    if (!built.ok) return setFormError(built.error)
    setFormError('')
    search.mutate({
      profile: built.profile,
      answers: opts.answers ?? answers,
      includeExcluded: opts.includeExcluded ?? includeExcluded,
    })
  }

  function answer(nctId: string, questionId: string, value: Answer) {
    const next = { ...answers, [nctId]: { ...answers[nctId], [questionId]: value } }
    setAnswers(next)
    run({ answers: next })
  }

  async function loadFile(file: File | undefined) {
    setFileError('')
    if (!file) return
    if (file.size > MAX_BYTES) return setFileError(`That file is too large (${Math.round(file.size / 1000)} KB; the limit is 200 KB).`)
    if (!/\.(txt|md)$/i.test(file.name) && !file.type.startsWith('text/')) return setFileError('Please upload a plain-text report (.txt).')
    setText(await file.text())
  }

  /** Load the next example report (or the first, if the box holds something else) and read it into the profile. */
  function nextExample() {
    if (examples.length === 0) return
    const next = examples[(exampleIndex + 1) % examples.length]
    setText(next.text)
    setFileError('')
    read.mutate(next.text)
  }

  const result = search.data
  // The list you are looking at (after the filter) and the one trial opened from it, if any.
  const shown = (result?.results ?? []).filter((m) => filter === 'all' || m.assessment === filter)
  const openIndex = shown.findIndex((m) => m.nct_id === openId)
  const opened = openIndex >= 0 ? shown[openIndex] : null
  const usingExample = exampleIndex >= 0

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pathology-informed discovery</p>
      <h1 className="mt-1 text-3xl font-semibold">Find trials worth reviewing</h1>

      <div className="stagger mt-8 grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
        {/* ---------- 1. Patient profile ---------- */}
        <section aria-labelledby="profile-h" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">01</p>
              <h2 id="profile-h" className="text-xl font-semibold">
                Patient profile
              </h2>
            </div>
          </div>

          <div role="tablist" aria-label="Profile source" className="mt-4 grid grid-cols-2 rounded border border-slate-200 bg-slate-100 p-0.5 text-sm font-medium">
            {(
              [
                ['report', 'Paste a report'],
                ['manual', 'Enter facts manually'],
              ] as const
            ).map(([id, name]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={`rounded px-3 py-1.5 ${mode === id ? 'bg-white shadow-sm' : 'text-slate-600'}`}
              >
                {name}
              </button>
            ))}
          </div>

          {mode === 'report' && (
            <div className="mt-4">
              <label htmlFor="report-text" className={label}>
                Pathology report
              </label>
              <textarea
                id="report-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={9}
                placeholder="Paste a synthetic-format report here, or upload a .txt file"
                className={`${input} font-mono text-xs`}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => read.mutate(text)}
                  disabled={!text.trim() || read.isPending}
                  className="flex-1 rounded border border-slate-900 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  {read.isPending ? 'Reading…' : 'Read report into profile'}
                </button>
                <label className="cursor-pointer rounded bg-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-300 focus-within:outline-2 focus-within:outline-blue-700">
                  Upload .txt
                  <input type="file" accept=".txt,.md,text/plain" className="sr-only" onChange={(e) => void loadFile(e.target.files?.[0])} />
                </label>
              </div>
              {(fileError || read.isError) && (
                <p role="alert" className="mt-2 text-sm text-red-800">
                  {fileError || read.error?.message}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">Uses the synthetic report format from Task A. Review what was extracted below.</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                {examples.length > 0 ? (
                  <button type="button" onClick={nextExample} className="text-sm font-medium text-blue-700 underline hover:text-blue-900">
                    {usingExample ? 'Next example →' : 'Load an example →'}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => run()}
                  disabled={search.isPending || !form.organ.trim()}
                  className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Find trials
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Review profile</h3>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          {reviewNote && mode === 'report' && <p className="mt-2 text-xs text-slate-500">{reviewNote}</p>}

          <div className="mt-3 space-y-3">
            <Field id="organ" text="Primary organ">
              <input id="organ" value={form.organ} onChange={(e) => set('organ', e.target.value)} className={input} />
            </Field>
            <Field id="histology" text="Histology">
              <input id="histology" value={form.histology} onChange={(e) => set('histology', e.target.value)} className={input} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="sex" text="Sex">
                <select id="sex" value={form.sex} onChange={(e) => set('sex', e.target.value as ProfileForm['sex'])} className={input}>
                  <option value="">Unknown</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </Field>
              <Field id="age" text="Age (years)">
                <input id="age" inputMode="numeric" value={form.age} onChange={(e) => set('age', e.target.value)} className={input} />
              </Field>
            </div>
            <Field id="stage" text="Overall stage">
              <input id="stage" value={form.stage} onChange={(e) => set('stage', e.target.value)} placeholder="e.g. Stage II" className={input} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="metastatic" text="Metastatic disease">
                <select id="metastatic" value={form.metastatic} onChange={(e) => set('metastatic', e.target.value as ProfileForm['metastatic'])} className={input}>
                  <option value="">Unknown</option>
                  <option value="non_metastatic">No</option>
                  <option value="metastatic">Yes</option>
                </select>
              </Field>
              <Field id="size" text="Tumour size (mm)">
                <input id="size" inputMode="decimal" value={form.tumorSize} onChange={(e) => set('tumorSize', e.target.value)} className={input} />
              </Field>
            </div>
            <Field id="naive" text="Treatment naive">
              <select id="naive" value={form.treatmentNaive} onChange={(e) => set('treatmentNaive', e.target.value as ProfileForm['treatmentNaive'])} className={input}>
                <option value="">Unknown</option>
                <option value="yes">Yes, no prior treatment</option>
                <option value="no">No, treated before</option>
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Marker id="er" text="ER" value={form.er} onChange={(v) => set('er', v)} />
              <Marker id="pr" text="PR" value={form.pr} onChange={(v) => set('pr', v)} />
              <Marker id="her2" text="HER2" value={form.her2} onChange={(v) => set('her2', v)} />
            </div>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <Field id="place" text="City or ZIP (optional)">
                <input id="place" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Palo Alto, CA" className={input} />
              </Field>
              <Field id="radius" text="Within">
                <select id="radius" value={form.radius} onChange={(e) => set('radius', e.target.value)} disabled={!form.location.trim()} className={`${input} disabled:opacity-50`}>
                  <option value="">Any distance</option>
                  {[25, 50, 100, 250].map((m) => (
                    <option key={m} value={m}>
                      {m} miles
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {formError && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {formError}
            </p>
          )}
          <button
            type="button"
            onClick={() => run()}
            disabled={search.isPending || !form.organ.trim()}
            className="mt-4 w-full rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {search.isPending ? 'Searching ClinicalTrials.gov…' : 'Find trials'}
          </button>
        </section>

        {/* ---------- 2. Review shortlist ---------- */}
        <section aria-labelledby="shortlist-h" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">02</p>
              <h2 id="shortlist-h" className="text-xl font-semibold">
                Review shortlist
              </h2>
            </div>
            {result && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={includeExcluded}
                  disabled={search.isPending}
                  onChange={(e) => {
                    setIncludeExcluded(e.target.checked)
                    run({ includeExcluded: e.target.checked })
                  }}
                />
                Show trials excluded by patient profile
              </label>
            )}
          </div>

          {!result && !search.isPending && !search.isError && (
            <p className="mt-6 rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Review the profile, then press <strong>Find trials</strong>. Open trials are fetched live from ClinicalTrials.gov and checked against it.
            </p>
          )}
          {search.isPending && !result && (
            <div role="status" className="mt-6 space-y-4" aria-label="Searching ClinicalTrials.gov">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-5">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton mt-3 h-5 w-5/6" />
                  <div className="skeleton mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          )}
          {search.isError && (
            <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-800">
              {search.error.message}
            </p>
          )}

          {result && (
            <div className={search.isPending ? 'opacity-60' : ''}>
              <p className="mt-3 text-xs text-slate-500">
                Searched ClinicalTrials.gov for open studies of “{result.search_term}”.
              </p>
              {result.not_matches_hidden && result.summary.not_a_match > 0 && (
                <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {result.summary.not_a_match} broad ClinicalTrials.gov result{result.summary.not_a_match === 1 ? ' was' : 's were'} hidden because the patient
                  profile contradicts an explicit eligibility requirement. Turn on “Show trials excluded by patient profile” to inspect why.
                </p>
              )}
              {result.results.length === 0 ? (
                <p className="mt-6 rounded border border-slate-200 p-4 text-slate-600">
                  {result.summary.likely_relevant + result.summary.needs_more_information + result.summary.not_a_match === 0
                    ? `No open trials were found for “${result.search_term}”. Try a broader histology.`
                    : 'No trials to review.'}
                </p>
              ) : opened ? (
                <div key={opened.nct_id} className="tab-enter mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => setOpenId(null)} className="text-sm font-medium text-blue-700 hover:underline">
                      ← All trials
                    </button>
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <button
                        type="button"
                        aria-label="Previous trial"
                        disabled={openIndex <= 0}
                        onClick={() => setOpenId(shown[openIndex - 1].nct_id)}
                        className="rounded border border-slate-300 px-2 py-0.5 hover:bg-blue-50 disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <span className="px-1 tabular-nums">
                        {openIndex + 1} of {shown.length}
                      </span>
                      <button
                        type="button"
                        aria-label="Next trial"
                        disabled={openIndex >= shown.length - 1}
                        onClick={() => setOpenId(shown[openIndex + 1].nct_id)}
                        className="rounded border border-slate-300 px-2 py-0.5 hover:bg-blue-50 disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <TrialCard match={opened} answers={answers[opened.nct_id]} onAnswer={answer} busy={search.isPending} />
                  </div>
                </div>
              ) : (
                <>
                  <div role="group" aria-label="Filter trials" className="mt-4 flex flex-wrap gap-2">
                    {FILTERS.map((f) => {
                      const n = f.key === 'all' ? result.results.length : result.results.filter((m) => m.assessment === f.key).length
                      if (f.key !== 'all' && n === 0) return null
                      return (
                        <button
                          key={f.key}
                          type="button"
                          aria-pressed={filter === f.key}
                          onClick={() => setFilter(f.key)}
                          className={`rounded-full border px-3 py-1 text-sm font-medium ${
                            filter === f.key ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-blue-50'
                          }`}
                        >
                          {f.label} <span className="tabular-nums opacity-80">{n}</span>
                        </button>
                      )
                    })}
                  </div>
                  <ul className="stagger mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                    {shown.map((m) => (
                      <li key={m.nct_id}>
                        <TrialRow match={m} onOpen={() => setOpenId(m.nct_id)} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-5 text-xs text-slate-500">{result.disclaimer}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
