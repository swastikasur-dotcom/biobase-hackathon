import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { patientsForTrial } from '../data/trials'
import { titleCase } from '../lib/organs'
import type { TrialAssessment } from '../types'

const CATS: { key: TrialAssessment; label: string; badge: string; bar: string }[] = [
  { key: 'likely_relevant', label: 'Likely relevant', badge: 'bg-blue-700 text-white', bar: 'bg-blue-700' },
  { key: 'needs_more_information', label: 'Needs information', badge: 'border border-slate-400 text-slate-800', bar: 'bg-blue-300' },
  { key: 'not_a_match', label: 'Ruled out', badge: 'bg-slate-200 text-slate-600', bar: 'bg-slate-300' },
]

/** Counts up to `value` once; shows the final number at once when motion is reduced. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (value === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(() => setShown(value), 0)
      return () => clearTimeout(t)
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700)
      setShown(Math.round(value * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span>{shown}</span>
}

/** Link a ClinicalTrials.gov trial, and see which of the test reports fit it best. */
export default function TrialPatients({ initial, onTrial }: { initial: string; onTrial: (nct: string) => void }) {
  const [input, setInput] = useState(initial)
  const [cat, setCat] = useState<'all' | TrialAssessment>('all')
  const find = useMutation({ mutationFn: patientsForTrial })
  const ran = useRef(false)

  function run(value = input) {
    if (!value.trim()) return
    ran.current = true // the URL update below must not trigger a second run
    find.mutate(value, { onSuccess: (r) => onTrial(r.trial.nct_id) })
  }
  // A link such as /patients?view=trial&trial=NCT... runs once on arrival.
  useEffect(() => {
    if (initial && !ran.current) {
      ran.current = true
      find.mutate(initial)
    }
  }, [initial, find])

  const r = find.data
  const total = r ? r.summary.likely_relevant + r.summary.needs_more_information + r.summary.not_a_match : 0
  const visible = (r?.results ?? []).filter((p) => cat === 'all' || p.assessment === cat)
  return (
    <div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <div className="min-w-0 flex-1 basis-80">
          <label htmlFor="trial-link" className="mb-1 block text-sm font-medium">
            ClinicalTrials.gov trial
          </label>
          <input
            id="trial-link"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="NCT03201861 or https://clinicaltrials.gov/study/NCT03201861"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || find.isPending}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {find.isPending ? 'Matching 979 reports…' : 'Find matching patients'}
        </button>
      </form>

      <div aria-live="polite">
        {find.isError && (
          <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-800">
            {find.error.message}
          </p>
        )}
        {find.isPending && (
          <div role="status" aria-label="Matching reports" className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="scan-bar h-full w-1/3 rounded-full bg-blue-600" />
            </div>
            <div className="mt-3 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          </div>
        )}
        {r && (
          <div className="tab-enter mt-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <a href={r.trial.official_url ?? undefined} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-blue-700 hover:underline">
                {r.trial.nct_id} ↗
              </a>
              <h2 className="mt-1 text-lg font-semibold leading-snug">{r.trial.title}</h2>
              {r.trial.conditions.length > 0 && <p className="mt-1 text-sm text-slate-500">{r.trial.conditions.slice(0, 5).join(' · ')}</p>}
              <p className="mt-2 text-xs text-slate-500">Registry status {r.trial.status.replace(/_/g, ' ').toLowerCase()}</p>
            </div>

            <div className="mt-4" role="group" aria-label="Fit by category">
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                {CATS.map((c, i) => {
                  const n = r.summary[c.key]
                  return n > 0 ? (
                    <div
                      key={c.key}
                      className={`svg-grow ${c.bar}`}
                      style={{ width: `${(n / total) * 100}%`, minWidth: '4px', '--d': `${0.15 * i}s` } as React.CSSProperties}
                    />
                  ) : null
                })}
              </div>
              <div className="stagger mt-3 flex flex-wrap gap-2">
                {[{ key: 'all' as const, label: 'All', n: total }, ...CATS.map((c) => ({ key: c.key, label: c.label, n: r.summary[c.key] }))].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={cat === f.key}
                    onClick={() => setCat(f.key)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium ${
                      cat === f.key ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-blue-50'
                    }`}
                  >
                    {f.label} <span className="tabular-nums opacity-80"><CountUp value={f.n} /></span>
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="mt-3 rounded border border-slate-200 bg-white p-4 text-slate-600">No test report in this category.</p>
            ) : (
              <ul key={cat} className="stagger mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {visible.map((p) => {
                  const c = CATS.find((x) => x.key === p.assessment)!
                  const why =
                    p.assessment === 'not_a_match'
                      ? p.exclusions[0]
                      : p.matched_facts.filter((f) => !/^condition mentions/i.test(f)).slice(0, 3).join(' · ') || p.matched_facts[0]
                  return (
                    <li key={p.report_id}>
                      <Link to={`/patients/all/${p.report_id}`} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 hover:bg-blue-50">
                        <span className="min-w-0">
                          <span className="font-mono text-sm text-blue-700">{p.report_id}</span>
                          <span className="ml-2 text-sm">
                            {[titleCase(p.profile.organ), p.profile.sex, p.profile.age_band && `age ${p.profile.age_band}`, p.profile.stage].filter(Boolean).join(' · ')}
                          </span>
                          {p.profile.histology && <span className="block truncate text-sm text-slate-600">{p.profile.histology}</span>}
                          <span className="block text-xs text-slate-500">
                            {why}
                            {p.questions.length > 0 && ` · ${p.questions.length} to confirm`}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.badge}`}>{c.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            {CATS.some((c) => r.summary[c.key] > r.shown[c.key]) && (
              <p className="mt-2 text-xs text-slate-500">Each category shows its best {Math.max(...Object.values(r.shown))} reports.</p>
            )}
            <p className="mt-3 text-xs text-slate-500">{r.review_note}</p>
          </div>
        )}
      </div>
    </div>
  )
}
