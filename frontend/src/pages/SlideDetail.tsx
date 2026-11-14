import { useParams } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Breadcrumbs from '../components/Breadcrumbs'
import ConfidenceBadge from '../components/ConfidenceBadge'
import SimilarMapSection from '../components/SimilarMapSection'
import TileViewer from '../components/TileViewer'
import Status from '../components/Status'
import { useSimilar, useSlideIndex } from '../data/api'
import { isLowConfidence, shortId, slideOrgan, thumbUrl } from '../lib/slides'
import type { Slide } from '../types'

const Row = ({ k, v }: { k: string; v?: string | number }) =>
  v == null || v === '' ? null : (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )

export default function SlideDetail() {
  const { slideId = '' } = useParams()
  useDocumentTitle(`Slide ${shortId(slideId)}`)
  const slides = useSlideIndex()
  const similar = useSimilar()
  const slide = slides.index.get(slideId)

  const similarSlides = (similar.data?.[slideId] ?? [])
    .map((id) => slides.index.get(id))
    .filter((s): s is Slide => !!s)

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Explore slides', to: '/slides' }, { label: shortId(slideId) }]} />
      <Status queries={[slides, similar]}>
        {!slide ? (
          <p role="alert">Unknown slide "{slideId}".</p>
        ) : (
          <SlideBody slide={slide} similarSlides={similarSlides} />
        )}
      </Status>
    </div>
  )
}

function SlideBody({ slide, similarSlides }: { slide: Slide; similarSlides: Slide[] }) {
  const { organ, predicted } = slideOrgan(slide)
  const low = slide.prediction && isLowConfidence(slide.prediction.confidence)

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <img
          src={thumbUrl(slide.id)}
          alt={`Thumbnail of slide ${shortId(slide.id)}`}
          className="max-h-[32rem] w-full rounded border border-slate-200 bg-white object-contain"
        />
        <aside>
          <h1 className="font-mono text-lg font-semibold">{shortId(slide.id)}</h1>
          <div className="mt-3 rounded border border-slate-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{predicted ? 'Predicted organ (C1)' : 'Organ'}</div>
            <div className="mt-1 flex items-center gap-2 text-xl font-semibold">
              {organ ?? 'Unknown'}
              {slide.prediction && <ConfidenceBadge confidence={slide.prediction.confidence} />}
            </div>
            {low && (
              <p className="mt-2 text-sm text-amber-900">
                The model is not confident about this slide. Check the organ manually; the similar slides below depend on it.
              </p>
            )}
            {!predicted && <p className="mt-2 text-sm text-slate-500">Known label from the supplier, not a prediction.</p>}
          </div>
          <dl className="mt-4">
            <Row k="Supplier" v={slide.supplierId} />
            <Row k="Stain" v={slide.stain} />
            <Row k="Magnification" v={slide.magnification ? `${slide.magnification}x` : undefined} />
            <Row k="Size" v={slide.width && slide.height ? `${slide.width} × ${slide.height} px` : undefined} />
            <Row k="Sex" v={slide.sex} />
            <Row k="Age" v={slide.ageBucket} />
            <Row k="Diagnosis" v={slide.diagnosis} />
            <Row k="Stage" v={slide.stage} />
          </dl>
        </aside>
      </div>

      {slide.report?.finalDiagnosis && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Slide report</h2>
          <p className="rounded border border-slate-200 bg-white p-3 text-sm">{slide.report.finalDiagnosis}</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">20x tissue tiles</h2>
        <TileViewer slide={slide} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Most similar slides (C2)</h2>
        {similarSlides.length === 0 ? (
          <p className="text-sm text-slate-500">
            Similar-slide lists exist only for the 67 held-out slides. {slide.heldout ? 'None found for this one.' : 'This slide is labelled, so it has none.'}
          </p>
        ) : (
          <SimilarMapSection slide={slide} similarSlides={similarSlides} />
        )}
      </section>
    </div>
  )
}
