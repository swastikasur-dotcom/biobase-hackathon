import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Breadcrumbs from '../components/Breadcrumbs'
import Status from '../components/Status'
import { useCohorts, useCriteria, useReportIndex } from '../data/api'
import { criterionOrgans, titleCase } from '../lib/organs'
import type { Criterion } from '../types'

export default function CriteriaList() {
  useDocumentTitle('Find patients')
  const criteria = useCriteria()
  const cohorts = useCohorts()
  const reports = useReportIndex()

  const groups = useMemo(() => {
    if (!criteria.data || !cohorts.data) return []
    const organs = criterionOrgans(cohorts.data, reports.index)
    const byOrgan = new Map<string, Criterion[]>()
    for (const c of criteria.data) {
      const organ = organs[c.id] ?? 'other'
      byOrgan.set(organ, [...(byOrgan.get(organ) ?? []), c])
    }
    return [...byOrgan]
  }, [criteria.data, cohorts.data, reports.index])

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Find patients' }]} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Browse cohorts</h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Choose a trial criterion to see the matching pathology reports among the 979 test reports, then export the cohort.
          </p>
        </div>
        <Link to="/patients/analyze" className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
          Analyse a pathology report
        </Link>
      </header>
      <div className="mt-6">
        <Status queries={[criteria, cohorts, reports]}>
          {groups.map(([organ, items]) => (
            <section key={organ} className="mb-8">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{titleCase(organ)}</h2>
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
      </div>
    </div>
  )
}
