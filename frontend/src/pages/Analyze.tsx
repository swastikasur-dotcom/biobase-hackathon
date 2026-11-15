import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AnalysisResultView from '../components/AnalysisResultView'
import Breadcrumbs from '../components/Breadcrumbs'
import { useReports } from '../data/api'
import { analyzeReport } from '../data/analyze'
import { titleCase } from '../lib/organs'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useDraft } from '../state/draft'

const MAX_BYTES = 200_000

export default function Analyze() {
  useDocumentTitle('Analyse a pathology report')
  const reports = useReports()
  const { text, setText } = useDraft()
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging] = useState(false)

  const analysis = useMutation({ mutationFn: analyzeReport })
  const result = analysis.data

  async function loadFile(file: File | undefined) {
    setFileError('')
    if (!file) return
    if (file.size > MAX_BYTES) return setFileError(`That file is too large (${Math.round(file.size / 1000)} KB; the limit is 200 KB).`)
    if (!/\.(txt|md)$/i.test(file.name) && !file.type.startsWith('text/')) {
      return setFileError('Please upload a plain-text report (.txt).')
    }
    setText(await file.text())
  }

  function trySample() {
    // Held-out test reports that match at least one criterion, so the demo always has results to show.
    const withResults = reports.data?.filter((r) => r.matches.length > 0)
    if (!withResults?.length) return
    setText(withResults[Math.floor(Math.random() * withResults.length)].text)
    setFileError('')
  }

  const canAnalyze = text.trim().length > 0 && !analysis.isPending
  const panel = 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm'

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Find patients', to: '/patients' }, { label: 'Analyse a report' }]} />
      <h1 className="text-2xl font-semibold">Analyse a pathology report</h1>
      <p className="mt-1 max-w-2xl text-slate-600">
        Upload or paste a report. It is read by the hackathon rules and by Jev, categorised against the 30 criteria, and
        summarised. The rules run in the local service and nothing is stored; Jev receives the report text to score it.
      </p>

      <div className="stagger mt-6 grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
        <section aria-labelledby="report-h" className={`${panel} lg:sticky lg:top-4`}>
          <h2 id="report-h" className="text-lg font-semibold">
            Report
          </h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (canAnalyze) analysis.mutate(text)
            }}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                void loadFile(e.dataTransfer.files[0])
              }}
              className={`rounded border-2 border-dashed p-3 ${dragging ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white'}`}
            >
              <label htmlFor="report-text" className="mb-1 block text-sm font-medium">
                Report text
              </label>
              <textarea
                id="report-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                placeholder="Paste a report here, or drop a .txt file onto this box"
                className="w-full rounded border border-slate-300 p-2 font-mono text-xs"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <label className="cursor-pointer rounded bg-slate-200 px-3 py-1.5 font-medium hover:bg-slate-300 focus-within:outline-2 focus-within:outline-blue-700">
                  Upload a .txt file
                  <input type="file" accept=".txt,.md,text/plain" className="sr-only" onChange={(e) => void loadFile(e.target.files?.[0])} />
                </label>
                {text && (
                  <button
                    type="button"
                    onClick={() => {
                      setText('')
                      setFileError('')
                      analysis.reset()
                    }}
                    className="rounded px-3 py-1.5 text-slate-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {fileError && (
                <p role="alert" className="mt-2 text-sm text-red-800">
                  {fileError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={trySample}
                disabled={!reports.data}
                className="text-sm font-medium text-blue-700 underline hover:text-blue-900 disabled:opacity-40"
              >
                Try a held-out sample →
              </button>
              <button
                type="submit"
                disabled={!canAnalyze}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {analysis.isPending ? 'Analysing…' : 'Analyse report'}
              </button>
            </div>
          </form>
        </section>

        <section aria-labelledby="result-h" aria-live="polite" className={panel}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="result-h" className="text-lg font-semibold">
              Result
            </h2>
            {result && (
              <p className="text-sm text-slate-600">
                {titleCase(result.organ)} report · matches <strong>{result.matches.length} of 30</strong> criteria
              </p>
            )}
          </div>

          {analysis.isError && (
            <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-800">
              {analysis.error.message}
            </p>
          )}
          {!result && !analysis.isPending && !analysis.isError && (
            <p className="mt-4 rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
              Add a report and press <strong>Analyse report</strong>. The summary, rule matches and Jev scores appear here.
            </p>
          )}
          {analysis.isPending && !result && (
            <div role="status" aria-label="Analysing" className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded border border-slate-200 p-4">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton mt-3 h-3 w-5/6" />
                </div>
              ))}
            </div>
          )}
          {result && (
            <div className={`mt-5 ${analysis.isPending ? 'opacity-60' : ''}`}>
              <AnalysisResultView result={result} />
            </div>
          )}
        </section>
      </div>

      <p className="mt-10 text-sm text-slate-600">
        Prefer to start from a criterion?{' '}
        <Link to="/patients" className="text-blue-700 hover:underline">
          Browse cohorts
        </Link>
        .
      </p>
    </div>
  )
}
