import { Link, useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Breadcrumbs from '../components/Breadcrumbs'
import JevBadge from '../components/JevBadge'
import Status from '../components/Status'
import { useCriteria, useJev, useReportIndex } from '../data/api'
import { jevScore } from '../lib/jev'

const META = new Set(['sex', 'age_band', 'report_year', 'specimen', 'organ'])

export default function ReportDetail() {
  const { criterionId = '', reportId = '' } = useParams()
  useDocumentTitle(`Report ${reportId}`)
  const criteria = useCriteria()
  const reports = useReportIndex()
  const jev = useJev()
  const report = reports.index.get(reportId)
  const criterionText = new Map((criteria.data ?? []).map((c) => [c.id, c.text]))

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Find patients', to: '/patients' },
          { label: criterionId, to: `/patients/${criterionId}` },
          { label: reportId },
        ]}
      />
      <Status queries={[criteria, reports]}>
        {!report ? (
          <p role="alert">Unknown report "{reportId}".</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <section>
              <h1 className="font-mono text-xl font-semibold">{report.id}</h1>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-4 text-sm leading-relaxed">
                {report.text}
              </pre>
            </section>
            <aside className="space-y-6">
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Matches {report.matches.length} criteri{report.matches.length === 1 ? 'on' : 'a'}
                </h2>
                {report.matches.length === 0 ? (
                  <p className="text-sm text-slate-500">None of the 30 criteria.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {report.matches.map((cid) => (
                      <li key={cid} className={cid === criterionId ? 'font-medium' : ''}>
                        <Link to={`/patients/${cid}`} className="text-blue-700 hover:underline">
                          <span className="font-mono">{cid}</span>
                        </Link>{' '}
                        {criterionText.get(cid)}
                        {jev.data && Object.keys(jev.data).length > 0 && (
                          <span className="ml-2 align-middle">
                            <JevBadge p={jevScore(jev.data, cid, report.id) ?? 0} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Parsed fields</h2>
                <dl className="space-y-2 text-sm">
                  {Object.entries(report.fields)
                    .sort(([a], [b]) => Number(META.has(b)) - Number(META.has(a)))
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-slate-500">{k}</dt>
                        <dd>{v == null ? '—' : String(v)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </aside>
          </div>
        )}
      </Status>
    </div>
  )
}
