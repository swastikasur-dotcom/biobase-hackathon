import { Link } from 'react-router-dom'
import { shortId, slideOrgan, thumbUrl } from '../lib/slides'
import type { Slide } from '../types'
import ConfidenceBadge from './ConfidenceBadge'

export default function SlideCard({
  slide,
  rank,
  active,
  onActiveChange,
}: {
  slide: Slide
  rank?: number
  /** Emphasised from outside, e.g. its dot is hovered on a map. */
  active?: boolean
  onActiveChange?: (active: boolean) => void
}) {
  const { organ, predicted } = slideOrgan(slide)
  return (
    <Link
      to={`/slides/${slide.id}`}
      className={`lift block overflow-hidden rounded border bg-white hover:border-slate-400 ${active ? 'border-blue-600 ring-2 ring-blue-600' : 'border-slate-200'}`}
      onMouseEnter={() => onActiveChange?.(true)}
      onMouseLeave={() => onActiveChange?.(false)}
      onFocus={() => onActiveChange?.(true)}
      onBlur={() => onActiveChange?.(false)}
    >
      <div className="relative aspect-square bg-slate-100">
        <img src={thumbUrl(slide.id)} alt={`Thumbnail of slide ${shortId(slide.id)}`} loading="lazy" className="h-full w-full object-contain" />
        {rank != null && (
          <span className="absolute left-1 top-1 rounded bg-blue-700 px-1.5 text-xs font-medium text-white">#{rank}</span>
        )}
      </div>
      <div className="space-y-1 p-2 text-sm">
        <div className="truncate font-mono text-xs text-slate-500" title={slide.id}>
          {shortId(slide.id)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium">{organ ?? 'Unknown'}</span>
          {predicted && <span className="text-xs text-slate-500">(predicted)</span>}
          {slide.prediction && <ConfidenceBadge confidence={slide.prediction.confidence} />}
        </div>
      </div>
    </Link>
  )
}
