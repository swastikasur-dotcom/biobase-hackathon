import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import PaperclipButton from '../components/PaperclipButton'
import SlideCard from '../components/SlideCard'
import SlideUploadCard from '../components/SlideUploadCard'
import Status from '../components/Status'
import { useSlidesFile } from '../data/api'
import { isLowConfidence, slideOrgan } from '../lib/slides'

type Scope = 'all' | 'heldout' | 'labelled' | 'review'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'All slides' },
  { value: 'heldout', label: 'Held-out (predicted)' },
  { value: 'review', label: 'Needs review (low confidence)' },
  { value: 'labelled', label: 'Labelled' },
]

export default function SlideBrowser() {
  useDocumentTitle('Slides')
  const file = useSlidesFile()
  const [scope, setScope] = useState<Scope>('all')
  const [params] = useSearchParams()
  const [organ, setOrgan] = useState(params.get('organ') ?? '')
  const [supplier, setSupplier] = useState('')

  const slides = file.data?.slides
  const suppliers = useMemo(() => [...new Set((slides ?? []).map((s) => s.supplierId).filter(Boolean))].sort() as string[], [slides])

  const shown = useMemo(() => {
    const rows = (slides ?? []).filter((s) => {
      if (scope === 'heldout' && !s.heldout) return false
      if (scope === 'labelled' && s.heldout) return false
      if (scope === 'review' && !(s.prediction && isLowConfidence(s.prediction.confidence))) return false
      if (organ && slideOrgan(s).organ !== organ) return false
      if (supplier && s.supplierId !== supplier) return false
      return true
    })
    // Least confident predictions first when looking at held-out slides.
    return scope === 'heldout' || scope === 'review'
      ? rows.sort((a, b) => (a.prediction?.confidence ?? 1) - (b.prediction?.confidence ?? 1))
      : rows
  }, [slides, scope, organ, supplier])

  const select = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm'

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Slides</h1>
          <p className="mt-1 max-w-xl text-slate-600">
            Held-out slides have no known organ: the organ shown is the model's prediction. Open one to see its confidence and
            the ten most similar slides.
          </p>
        </div>
        <SlideUploadCard />
      </div>
      <Status queries={[file]}>
        <div className="mt-6 flex flex-wrap gap-3">
          <select aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)} className={select}>
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select aria-label="Organ" value={organ} onChange={(e) => setOrgan(e.target.value)} className={select}>
            <option value="">All organs</option>
            {file.data?.organGroups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <PaperclipButton organ={organ || undefined} />
          <select aria-label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={select}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="self-center text-sm text-slate-500">
            {shown.length} of {slides?.length ?? 0}
          </span>
          <Link to="/slides/map" className="ml-auto self-center text-sm text-blue-700 hover:underline">
            View as map →
          </Link>
        </div>
        {shown.length === 0 ? (
          <p className="mt-6 text-slate-500">No slides match these filters.</p>
        ) : (
          <ul className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shown.map((s) => (
              <li key={s.id}>
                <SlideCard slide={s} />
              </li>
            ))}
          </ul>
        )}
      </Status>
    </div>
  )
}
