import { shortId, slideOrgan, thumbUrl } from '../lib/slides'
import type { Slide } from '../types'
import ConfidenceBadge from './ConfidenceBadge'

const Row = ({ k, v }: { k: string; v?: string | number }) =>
  v == null || v === '' ? null : (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  )

/** Floating preview shown when hovering or focusing a dot on the slide map. */
export default function SlideHoverCard({ slide, badge }: { slide: Slide; badge?: string }) {
  const { organ, predicted } = slideOrgan(slide)
  return (
    <div className="fade-in w-56 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs shadow-xl">
      <div className="relative aspect-[4/3] bg-slate-100">
        <img src={thumbUrl(slide.id)} alt="" className="h-full w-full object-contain" />
        {badge && <span className="absolute left-1.5 top-1.5 rounded bg-blue-700 px-1.5 py-0.5 font-medium text-white">{badge}</span>}
      </div>
      <div className="space-y-1.5 p-2.5">
        <div className="truncate font-mono text-[11px] text-slate-500" title={slide.id}>
          {shortId(slide.id)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          {organ ?? 'Unknown'}
          {predicted && <span className="text-xs font-normal text-slate-500">(predicted)</span>}
          {slide.prediction && <ConfidenceBadge confidence={slide.prediction.confidence} />}
        </div>
        <dl className="space-y-0.5">
          <Row k="Diagnosis" v={slide.diagnosis} />
          <Row k="Stage" v={slide.stage} />
          <Row k="Stain" v={[slide.stain, slide.magnification ? `${slide.magnification}x` : undefined].filter(Boolean).join(' · ')} />
          <Row k="Patient" v={[slide.sex, slide.ageBucket].filter(Boolean).join(' · ')} />
          <Row k="Supplier" v={slide.supplierId} />
        </dl>
        <div className="pt-0.5 text-slate-400">Click to open</div>
      </div>
    </div>
  )
}
