import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Breadcrumbs from '../components/Breadcrumbs'
import JevBadge from '../components/JevBadge'
import Status from '../components/Status'
import { useCohorts, useCriteria, useJev, useReportIndex } from '../data/api'
import { downloadCsv } from '../lib/csv'
import { jevPercent, jevScore } from '../lib/jev'
import { titleCase } from '../lib/organs'
import type { Report } from '../types'

const str = (v: unknown) => (v == null ? '' : String(v))
const diagnosis = (r: Report) => str(r.fields['Diagnosis'] ?? r.fields['Histologic type'])
const stage = (r: Report) => str(r.fields['Pathologic stage (AJCC 8th ed.)'])

export default function Cohort() {
  const { criterionId = '' } = useParams()
  useDocumentTitle(`Criterion ${criterionId}`)
  const criteria = useCriteria()
  const cohorts = useCohorts()
  const reports = useReportIndex()
  const jev = useJev()
  const [query, setQuery] = useState('')
  const [reviewFirst, setReviewFirst] = useState(false)
  const score = (rid: string) => jevScore(jev.data, criterionId, rid)
  const hasJev = !!jev.data && Object.keys(jev.data).length > 0

  const criterion = criteria.data?.find((c) => c.id === criterionId)
  const members = useMemo(
    () => (cohorts.data?.[criterionId] ?? []).map((id) => reports.index.get(id)).filter((r): r is Report => !!r),
    [cohorts.data, criterionId, reports.index],
  )
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? members.filter((r) => `${r.id} ${diagnosis(r)} ${stage(r)} ${str(r.fields.specimen)}`.toLowerCase().includes(q)) : members
    if (!reviewFirst || !jev.data) return filtered
    return [...filtered].sort((a, b) => (jevScore(jev.data, criterionId, a.id) ?? 0) - (jevScore(jev.data, criterionId, b.id) ?? 0))
  }, [members, query, reviewFirst, jev.data, criterionId])
  const toReview = hasJev ? members.filter((r) => (score(r.id) ?? 1) < 0.5).length : 0

  const exportCsv = () =>
    downloadCsv(`${criterionId}_cohort.csv`, [
      ['report_id', 'organ', 'sex', 'age_band', 'report_year', 'diagnosis', 'stage', ...(hasJev ? ['jev_probability'] : [])],
      ...shown.map((r) => [r.id, str(r.fields.organ), str(r.fields.sex), str(r.fields.age_band), str(r.fields.report_year), diagnosis(r), stage(r), ...(hasJev ? [jevPercent(score(r.id) ?? 0)] : [])]),
    ])

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Find patients', to: '/patients' },
          { label: criterionId },
        ]}
      />
      <Status queries={[criteria, cohorts, reports]}>
        {!criterion ? (
          <p role="alert">Unknown criterion "{criterionId}".</p>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">{criterion.text}</h1>
            <p className="mt-1 text-slate-600">
              {members.length} matching report{members.length === 1 ? '' : 's'}
              {shown.length !== members.length && ` (${shown.length} shown)`}
              {hasJev && toReview > 0 && ` · ${toReview} to review (Jev under 50%)`}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by id, diagnosis, stage or specimen"
                aria-label="Filter reports"
                className="w-full max-w-md rounded border border-slate-300 bg-white px-3 py-1.5"
              />
              {hasJev && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={reviewFirst} onChange={(e) => setReviewFirst(e.target.checked)} />
                  Lowest Jev score first
                </label>
              )}
              <button
                type="button"
                onClick={exportCsv}
                disabled={shown.length === 0}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Export CSV
              </button>
            </div>
            <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    {['Report', 'Organ', 'Sex', 'Age', 'Year', 'Diagnosis', 'Stage', ...(hasJev ? ['Jev'] : [])].map((h) => (
                      <th key={h} className="px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono">
                        <Link to={`/patients/${criterionId}/${r.id}`} className="text-blue-700 hover:underline">
                          {r.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{titleCase(str(r.fields.organ))}</td>
                      <td className="px-3 py-2">{str(r.fields.sex)}</td>
                      <td className="px-3 py-2">{str(r.fields.age_band)}</td>
                      <td className="px-3 py-2">{str(r.fields.report_year)}</td>
                      <td className="px-3 py-2">{diagnosis(r)}</td>
                      <td className="px-3 py-2">{stage(r)}</td>
                      {hasJev && (
                        <td className="px-3 py-2">
                          <JevBadge p={score(r.id) ?? 0} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length === 0 && <p className="p-4 text-slate-500">No reports match this filter.</p>}
            </div>
          </>
        )}
      </Status>
    </div>
  )
}
