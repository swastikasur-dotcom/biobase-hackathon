import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Breadcrumbs from '../components/Breadcrumbs'
import Status from '../components/Status'
import { useCohorts, useCriteria, useReportIndex } from '../data/api'
import { downloadCsv } from '../lib/csv'
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
  const [query, setQuery] = useState('')

  const criterion = criteria.data?.find((c) => c.id === criterionId)
  const members = useMemo(
    () => (cohorts.data?.[criterionId] ?? []).map((id) => reports.index.get(id)).filter((r): r is Report => !!r),
    [cohorts.data, criterionId, reports.index],
  )
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? members.filter((r) => `${r.id} ${diagnosis(r)} ${stage(r)} ${str(r.fields.specimen)}`.toLowerCase().includes(q)) : members
  }, [members, query])

  const exportCsv = () =>
    downloadCsv(`${criterionId}_cohort.csv`, [
      ['report_id', 'organ', 'sex', 'age_band', 'report_year', 'diagnosis', 'stage'],
      ...shown.map((r) => [r.id, str(r.fields.organ), str(r.fields.sex), str(r.fields.age_band), str(r.fields.report_year), diagnosis(r), stage(r)]),
    ])

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Find patients', to: '/patients' },
          { label: 'Browse cohorts', to: '/patients/browse' },
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
            </p>
            <div className="mt-4 flex gap-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by id, diagnosis, stage or specimen"
                aria-label="Filter reports"
                className="w-full max-w-md rounded border border-slate-300 bg-white px-3 py-1.5"
              />
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
                    {['Report', 'Organ', 'Sex', 'Age', 'Year', 'Diagnosis', 'Stage'].map((h) => (
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
