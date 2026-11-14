import { useEffect, useRef, useState } from 'react'
import { usePaperclip } from '../data/api'
import { citation, forOrgan, micrographChips, paperclipImageUrl } from '../lib/paperclip'
import type { Biomarker, Micrograph } from '../types'
import PaperclipIcon from './PaperclipIcon'

type Tab = 'micrographs' | 'biomarkers' | 'profile'

const Field = ({ k, v }: { k: string; v?: string | number | null }) =>
  v == null || v === '' ? null : (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )

const PaperLink = ({ x }: { x: { study: string; year: number | null; journal: string; link: string } }) => (
  <a href={x.link} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900">
    {citation(x)} ↗
  </a>
)

/** Side panel with the Paperclip literature results for one organ group. */
export default function PaperclipPanel({ organ, onClose }: { organ: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const paperclip = usePaperclip()
  const [tab, setTab] = useState<Tab>('micrographs')
  const [selected, setSelected] = useState<Micrograph | null>(null)

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const results = paperclip.data ? forOrgan(paperclip.data, organ) : null
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'micrographs', label: 'H&E micrographs', count: results?.micrographs.length },
    { id: 'biomarkers', label: 'Biomarkers', count: results?.biomarkers.length },
    { id: 'profile', label: 'Biobase slides' },
  ]

  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-labelledby="paperclip-h"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="paperclip-h" className="flex items-center gap-2 text-lg font-semibold">
                <PaperclipIcon className="h-5 w-5" />
                Paperclip results: {organ}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Reference images and biomarkers for this organ, found in open-access papers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close Paperclip results"
              className="rounded px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
            >
              ×
            </button>
          </div>
          <div role="tablist" aria-label="Paperclip result types" className="mt-3 flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id)
                  setSelected(null)
                }}
                className={`rounded px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                {t.label}
                {t.count != null && <span className="ml-1.5 opacity-70">{t.count}</span>}
              </button>
            ))}
          </div>
        </header>

        <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
          {paperclip.isPending && <p className="text-slate-500">Loading Paperclip results…</p>}
          {paperclip.isError && (
            <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {(paperclip.error as Error).message}
            </p>
          )}
          {results && tab === 'micrographs' &&
            (selected ? (
              <MicrographDetail m={selected} onBack={() => setSelected(null)} />
            ) : results.micrographs.length === 0 ? (
              <p className="text-slate-600">The search found no H&E tumour micrographs for {organ}.</p>
            ) : (
              <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
                {results.micrographs.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(m)}
                      className="lift block w-full overflow-hidden rounded border border-slate-200 bg-white text-left hover:border-slate-400"
                    >
                      <img src={paperclipImageUrl(m.image)} alt={`${m.diagnosis || organ} micrograph`} loading="lazy" className="aspect-square w-full bg-slate-100 object-cover" />
                      <div className="space-y-1 p-2 text-xs">
                        <div className="line-clamp-2 font-medium">{m.diagnosis || 'Tumour'}</div>
                        <div className="text-slate-500">{micrographChips(m).join(' · ')}</div>
                        {m.qc && <div className="text-amber-800">QC flag</div>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {results && tab === 'biomarkers' &&
            (results.biomarkers.length === 0 ? (
              <p className="text-slate-600">The search found no biomarker findings for {organ}.</p>
            ) : (
              <ul className="stagger space-y-3">
                {results.biomarkers.map((b, i) => (
                  <BiomarkerItem key={`${b.biomarker}-${i}`} b={b} />
                ))}
              </ul>
            ))}

          {results && tab === 'profile' &&
            (results.profile ? (
              <div>
                <p className="mb-3 text-sm text-slate-600">What the labelled Biobase slides of this organ look like, to compare against the papers.</p>
                <dl>
                  <Field k="Labelled slides" v={results.profile.slides} />
                  <Field k="Diagnoses" v={results.profile.diagnoses} />
                  <Field k="Stages" v={results.profile.stages} />
                  <Field k="Stains" v={results.profile.stains} />
                  <Field k="Reported markers" v={results.profile.markers} />
                  <Field k="Scan magnification" v={results.profile.magnification} />
                </dl>
              </div>
            ) : (
              <p className="text-slate-600">No profile for {organ}.</p>
            ))}
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Stored results of a Paperclip search of open-access papers, not a live query. Dataset: {paperclip.data?.dataset ?? 'Paperclip v3'}. Images are
          journal figures and the search returned no licences: check each paper's licence before reusing an image. Some images have drawn annotations.
        </footer>
      </div>
    </dialog>
  )
}

function MicrographDetail({ m, onBack }: { m: Micrograph; onBack: () => void }) {
  return (
    <div className="fade-in space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-blue-700 hover:underline">
        ← All micrographs
      </button>
      <img src={paperclipImageUrl(m.image)} alt={`${m.diagnosis} micrograph`} className="max-h-96 w-full rounded border border-slate-200 bg-slate-100 object-contain" />
      <h3 className="text-base font-semibold">{m.diagnosis}</h3>
      {m.qc && (
        <p role="note" className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          Dataset QC flag: {m.qc}
          {m.qcNote && ` (${m.qcNote})`}
        </p>
      )}
      <dl>
        <Field k="Site" v={m.site} />
        <Field k="Stain" v={m.stain} />
        <Field k="Magnification" v={m.magnification ? `about ${m.magnification}x` : undefined} />
        <Field k="Grade" v={m.grade} />
        <Field k="Stage" v={m.stage} />
        <Field k="Specimen" v={m.specimen} />
      </dl>
      {m.features && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key features</div>
          <p className="mt-1 text-sm">{m.features}</p>
        </div>
      )}
      {m.caption && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Figure caption</div>
          <p className="mt-1 text-sm text-slate-700">{m.caption}</p>
        </div>
      )}
      <div className="text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</div>
        <p className="mt-1">{m.title}</p>
        <p className="mt-1">
          <PaperLink x={m} />
        </p>
      </div>
    </div>
  )
}

function BiomarkerItem({ b }: { b: Biomarker }) {
  return (
    <li className="rounded border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{b.biomarker}</span>
        {b.direction && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
            {b.direction === 'Up' ? '↑ Up' : b.direction === 'Down' ? '↓ Down' : b.direction} vs {b.comparator || 'normal'}
          </span>
        )}
        {b.use && <span className="text-xs text-slate-500">{b.use}</span>}
      </div>
      <p className="mt-1 text-sm text-slate-600">{b.tumour}</p>
      <dl className="mt-2">
        <Field k="Method" v={b.method} />
        <Field k="Result" v={b.value} />
        <Field k="Stage or grade" v={b.association} />
      </dl>
      {b.quote && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-slate-600">Evidence from the paper</summary>
          <blockquote className="mt-1 border-l-2 border-slate-300 pl-3 text-slate-700">{b.quote}</blockquote>
        </details>
      )}
      <p className="mt-2 text-sm">
        <PaperLink x={b} />
      </p>
    </li>
  )
}
