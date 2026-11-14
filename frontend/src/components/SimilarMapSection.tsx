import { useMemo, useState } from 'react'
import { useSlideIndex, useUmap } from '../data/api'
import { slideOrgan } from '../lib/slides'
import type { Slide } from '../types'
import SlideCard from './SlideCard'
import UmapScatter, { UmapLegend } from './UmapScatter'

/** The ten similar slides as a grid, next to a map that greys out everything else and highlights them. */
export default function SimilarMapSection({ slide, similarSlides }: { slide: Slide; similarSlides: Slide[] }) {
  const slides = useSlideIndex()
  const umap = useUmap()
  const [activeId, setActiveId] = useState<string | null>(null)

  const placed = useMemo(() => new Set((umap.data?.points ?? []).map((p) => p.id)), [umap.data])
  const organs = useMemo(
    () => new Set([slide, ...similarSlides].map((s) => slideOrgan(s).organ).filter((o): o is string => !!o)),
    [slide, similarSlides],
  )

  if (similarSlides.length === 0) return null
  const unplaced = similarSlides.filter((s) => !placed.has(s.id)).length

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <ol className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {similarSlides.map((s, i) => (
          <li key={s.id}>
            <SlideCard slide={s} rank={i + 1} active={activeId === s.id} onActiveChange={(on) => setActiveId(on ? s.id : null)} />
          </li>
        ))}
      </ol>

      <div className="space-y-2 self-start lg:sticky lg:top-4">
        {umap.isPending || slides.isPending ? (
          <p className="text-sm text-slate-500">Loading map…</p>
        ) : umap.isError || !umap.data || !slides.data ? (
          <p role="alert" className="text-sm text-red-800">
            The map could not be loaded.
          </p>
        ) : !placed.has(slide.id) ? (
          <p className="text-sm text-slate-500">This slide has no embedding, so it cannot be placed on the map.</p>
        ) : (
          <>
            <UmapScatter
              points={umap.data.points}
              slides={slides.index}
              organGroups={slides.data.organGroups}
              focus={{ queryId: slide.id, similarIds: similarSlides.map((s) => s.id) }}
              activeId={activeId ?? undefined}
              onActiveChange={setActiveId}
              maxWidth={420}
            />
            <UmapLegend organGroups={slides.data.organGroups} only={organs} focus />
            <p className="text-xs text-slate-500">
              Map: {umap.data.method} of {umap.data.model === 'gigapath' ? 'GigaPath' : umap.data.model} slide embeddings.
              {unplaced > 0 && ` ${unplaced} of the ten has no embedding and is not shown.`}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
