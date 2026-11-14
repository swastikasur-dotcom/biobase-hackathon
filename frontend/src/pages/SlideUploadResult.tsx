import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import ConfidenceBadge from '../components/ConfidenceBadge'
import PaperclipButton from '../components/PaperclipButton'
import SimilarMapSection from '../components/SimilarMapSection'
import Status from '../components/Status'
import { useSimilar, useSlideIndex } from '../data/api'
import { isLowConfidence, pickHeldoutSlide, shortId, thumbUrl } from '../lib/slides'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { Slide, SlideUploadState } from '../types'

export default function SlideUploadResult() {
  useDocumentTitle('Slide analysis')
  const navigate = useNavigate()
  const state = useLocation().state as SlideUploadState | null
  const slides = useSlideIndex()
  const similar = useSimilar()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [state?.slideId])

  if (!state?.slideId) return <Navigate to="/slides" replace />
  const { slideId, file } = state
  const slide = slides.index.get(slideId)
  const similarSlides = (similar.data?.[slideId] ?? []).map((id) => slides.index.get(id)).filter((s): s is Slide => !!s)

  function another() {
    const next = pickHeldoutSlide(slides.data?.slides ?? [], Math.random, slideId)
    if (next) navigate('/slides/analysis', { state: { file, slideId: next.id } satisfies SlideUploadState, replace: true })
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Explore slides', to: '/slides' }, { label: 'Slide analysis' }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          Slide analysis
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/slides')}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
          >
            ← Back to slides
          </button>
          <button type="button" onClick={another} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            Show another random slide
          </button>
        </div>
      </header>

      <Status queries={[slides, similar]}>
        {!slide ? (
          <p role="alert" className="mt-6">
            Could not find slide "{slideId}".
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
              <img
                src={thumbUrl(slide.id)}
                alt={`Thumbnail of slide ${shortId(slide.id)}`}
                className="max-h-[28rem] w-full rounded border border-slate-200 bg-white object-contain"
              />
              <aside className="space-y-3">
                <div className="rounded border border-slate-200 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Predicted organ (C1)</div>
                  <div className="mt-1 flex items-center gap-2 text-xl font-semibold">
                    {slide.prediction?.organ ?? 'Unknown'}
                    {slide.prediction && <ConfidenceBadge confidence={slide.prediction.confidence} />}
                  </div>
                  {slide.prediction && isLowConfidence(slide.prediction.confidence) && (
                    <p className="mt-2 text-sm text-amber-900">
                      The model is not confident about this slide. Check the organ manually; the similar slides depend on it.
                    </p>
                  )}
                </div>
                <PaperclipButton organ={slide.prediction?.organ} />
                <Link to={`/slides/${slide.id}`} className="block text-sm text-blue-700 hover:underline">
                  Open the full slide page (tiles, details) →
                </Link>
              </aside>
            </div>

            <section aria-labelledby="similar-h">
              <h2 id="similar-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Most similar slides (C2)
              </h2>
              {similarSlides.length === 0 ? (
                <p className="text-sm text-slate-500">No similar-slide list for this slide.</p>
              ) : (
                <SimilarMapSection slide={slide} similarSlides={similarSlides} />
              )}
            </section>
          </div>
        )}
      </Status>
    </div>
  )
}
