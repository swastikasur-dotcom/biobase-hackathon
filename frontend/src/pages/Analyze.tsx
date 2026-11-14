import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import { useReports } from '../data/api'
import { analyzeReport } from '../data/analyze'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useDraft } from '../state/draft'
import type { ResultLocationState } from '../types'

const MAX_BYTES = 200_000

export default function Analyze() {
  useDocumentTitle('Find patients')
  const reports = useReports()
  const navigate = useNavigate()
  const { text, setText } = useDraft()
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging] = useState(false)

  const analysis = useMutation({
    mutationFn: analyzeReport,
    onSuccess: (result, analysed) => {
      const state: ResultLocationState = { result, text: analysed }
      navigate('/patients/result', { state })
    },
  })

  async function loadFile(file: File | undefined) {
    setFileError('')
    if (!file) return
    if (file.size > MAX_BYTES) return setFileError(`That file is too large (${Math.round(file.size / 1000)} KB; the limit is 200 KB).`)
    if (!/\.(txt|md)$/i.test(file.name) && !file.type.startsWith('text/')) {
      return setFileError('Please upload a plain-text report (.txt).')
    }
    setText(await file.text())
    analysis.reset()
  }

  function trySample() {
    // Held-out test reports that match at least one criterion, so the demo always has results to show.
    const withResults = reports.data?.filter((r) => r.matches.length > 0)
    if (!withResults?.length) return
    setText(withResults[Math.floor(Math.random() * withResults.length)].text)
    setFileError('')
    analysis.reset()
  }

  const canAnalyze = text.trim().length > 0 && !analysis.isPending

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Find patients' }]} />
      <h1 className="text-2xl font-semibold">Analyse a pathology report</h1>
      <p className="mt-1 max-w-2xl text-slate-600">
        Upload or paste a report. It is read by the same rules used for the hackathon search, categorised against the 30
        criteria, and explained. The report is processed by the local service only and is not stored.
      </p>

      <form
        className="mt-6 space-y-3"
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
            onChange={(e) => {
              setText(e.target.value)
              analysis.reset()
            }}
            rows={10}
            placeholder="Paste a report here, or drop a .txt file onto this box"
            className="w-full rounded border border-slate-300 p-2 font-mono text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <label className="cursor-pointer rounded bg-slate-200 px-3 py-1.5 font-medium hover:bg-slate-300 focus-within:outline-2 focus-within:outline-blue-700">
              Upload a .txt file
              <input type="file" accept=".txt,.md,text/plain" className="sr-only" onChange={(e) => void loadFile(e.target.files?.[0])} />
            </label>
            <button
              type="button"
              onClick={trySample}
              disabled={!reports.data}
              className="rounded px-3 py-1.5 text-blue-700 hover:underline disabled:opacity-40"
            >
              Try a held-out sample report
            </button>
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

        <button
          type="submit"
          disabled={!canAnalyze}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {analysis.isPending ? 'Analysing…' : 'Analyse report'}
        </button>
      </form>

      <div className="mt-8" aria-live="polite">
        {analysis.isError && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
            {analysis.error.message}
          </p>
        )}
      </div>

      <p className="mt-10 text-sm text-slate-600">
        Prefer to start from a criterion?{' '}
        <Link to="/patients/browse" className="text-blue-700 hover:underline">
          Browse cohorts
        </Link>
        .
      </p>
    </div>
  )
}
