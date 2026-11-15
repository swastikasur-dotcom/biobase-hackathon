import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Breadcrumbs from '../components/Breadcrumbs'
import Status from '../components/Status'
import TrialPatients from '../components/TrialPatients'
import { useCohorts, useCriteria, useReportIndex } from '../data/api'
import { criterionOrgans, titleCase } from '../lib/organs'
import type { Criterion } from '../types'

type View = 'criteria' | 'trial'

export default function CriteriaList() {
  useDocumentTitle('Find patients')
  const criteria = useCriteria()
  const cohorts = useCohorts()
  const reports = useReportIndex()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'trial' ? 'trial' : 'criteria'
  const [query, setQuery] = useState('')
  const [organ, setOrgan] = useState('')
  const [withPatients, setWithPatients] = useState(false)

  const setView = (v: View) =>
    setParams(v === 'trial' ? { view: 'trial', ...(params.get('trial') ? { trial: params.get('trial')! } : {}) } : {}, { replace: true })

  const organs = useMemo(
    () => (criteria.data && cohorts.data ? criterionOrgans(cohorts.data, reports.index) : {}),
    [criteria.data, cohorts.data, reports.index],
  )
  const organList = useMemo(() => [...new Set(Object.values(organs))].sort(), [organs])

  const groups = useMemo(() => {
    if (!criteria.data || !cohorts.data) return []
    const q = query.trim().toLowerCase()
    const byOrgan = new Map<string, Criterion[]>()
    for (const c of criteria.data) {
      const o = organs[c.id] ?? 'other'
      if (organ && o !== organ) continue
      if (withPatients && !(cohorts.data[c.id]?.length ?? 0)) continue
      if (q && !`${c.id} ${c.text}`.toLowerCase().includes(q)) continue
      byOrgan.set(o, [...(byOrgan.get(o) ?? []), c])
    }
    return [...byOrgan]
  }, [criteria.data, cohorts.data, organs, query, organ, withPatients])
  const shownCount = groups.reduce((n, [, items]) => n + items.length, 0)

  const field = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-sm'
  const tab = (active: boolean) =>
    `relative z-10 rounded px-4 py-1.5 text-center text-sm font-medium transition-colors ${active ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Find patients' }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">Browse cohorts</h1>
        <Link to="/patients/analyze" className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          Analyse a report
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Find patients by" className="relative inline-grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {/* The white pill slides to the chosen tab. */}
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded bg-white shadow-sm transition-transform duration-300 ease-out"
            style={{ transform: view === 'trial' ? 'translateX(calc(100% + 0.25rem))' : 'none' }}
          />
          <button type="button" role="tab" aria-selected={view === 'criteria'} onClick={() => setView('criteria')} className={tab(view === 'criteria')}>
            By criterion
          </button>
          <button type="button" role="tab" aria-selected={view === 'trial'} onClick={() => setView('trial')} className={tab(view === 'trial')}>
            For a clinical trial
          </button>
        </div>
        {view === 'criteria' && criteria.data && cohorts.data && (
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <input
              type="search"
              aria-label="Filter criteria"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter criteria, e.g. HER2 or lymph"
              className={`${field} w-72`}
            />
            <select aria-label="Organ" value={organ} onChange={(e) => setOrgan(e.target.value)} className={field}>
              <option value="">All organs</option>
              {organList.map((o) => (
                <option key={o} value={o}>
                  {titleCase(o)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withPatients} onChange={(e) => setWithPatients(e.target.checked)} />
              Only criteria with patients
            </label>
            <span className="text-sm text-slate-500">
              {shownCount} of {criteria.data?.length ?? 0}
            </span>
          </div>
        )}
      </div>

      <div key={view} className="tab-enter mt-6">
        {view === 'trial' ? (
          <TrialPatients
            initial={params.get('trial') ?? ''}
            onTrial={(nct) => setParams({ view: 'trial', trial: nct }, { replace: true })}
          />
        ) : (
          <Status queries={[criteria, cohorts, reports]}>
            {groups.length === 0 && <p className="text-slate-500">No criteria match these filters.</p>}
            {groups.map(([o, items]) => (
              <section key={o} className="mb-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{titleCase(o)}</h2>
                <ul className="stagger grid gap-2 md:grid-cols-2">
                  {items.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/patients/${c.id}`}
                        className="lift flex h-full items-start justify-between gap-3 rounded border border-slate-200 bg-white p-3 hover:border-slate-400"
                      >
                        <span>
                          <span className="mr-2 font-mono text-xs text-slate-500">{c.id}</span>
                          {c.text}
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-sm tabular-nums">
                          {cohorts.data?.[c.id]?.length ?? 0}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </Status>
        )}
      </div>
    </div>
  )
}
