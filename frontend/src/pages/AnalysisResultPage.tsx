import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import AnalysisResultView from '../components/AnalysisResultView'
import Breadcrumbs from '../components/Breadcrumbs'
import { titleCase } from '../lib/organs'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useDraft } from '../state/draft'
import type { ResultLocationState } from '../types'

export default function AnalysisResultPage() {
  useDocumentTitle('Report analysis')
  const navigate = useNavigate()
  const { setText } = useDraft()
  const state = useLocation().state as ResultLocationState | null
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  // Opened directly (no analysis in history): nothing to show, so go to the upload page.
  if (!state?.result) return <Navigate to="/patients/analyze" replace />
  const { result, text } = state

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Find patients', to: '/patients' }, { label: 'Analyse a report', to: '/patients/analyze' }, { label: 'Report analysis' }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
            Report analysis
          </h1>
          <p className="mt-1 text-slate-600">
            {titleCase(result.organ)} report · matches{' '}
            <strong>
              {result.matches.length} of 30
            </strong>{' '}
            criteria
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/patients/analyze')}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
          >
            ← Edit report
          </button>
          <button
            type="button"
            onClick={() => {
              setText('')
              navigate('/patients/analyze')
            }}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Analyse another report
          </button>
        </div>
      </header>

      <div className="mt-6">
        <AnalysisResultView result={result} />
      </div>

      <details className="mt-8 rounded border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium">The report you submitted</summary>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm">{text}</pre>
      </details>

      <p className="mt-10 text-sm text-slate-600">
        Want to explore a criterion further?{' '}
        <Link to="/patients" className="text-blue-700 hover:underline">
          Browse cohorts
        </Link>
        .
      </p>
    </div>
  )
}
