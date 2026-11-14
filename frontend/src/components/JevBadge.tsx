import { jevPercent, needsReview } from '../lib/jev'

/** Jev's probability that a report meets a criterion, amber when it is under 50%. */
export default function JevBadge({ p }: { p: number }) {
  const review = needsReview(p)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
        review ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
      }`}
      title={
        review
          ? 'Jev is not sure this report meets the criterion: check it manually'
          : "Jev's probability that this report meets the criterion"
      }
    >
      {jevPercent(p)}
      {review && <span> · review</span>}
    </span>
  )
}
