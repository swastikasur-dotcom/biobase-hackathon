import { isLowConfidence } from '../lib/slides'

export default function ConfidenceBadge({ confidence }: { confidence: number }) {
  const low = isLowConfidence(confidence)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
        low ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
      }`}
      title={low ? 'Low confidence: review this prediction manually' : 'Confidence of the organ prediction'}
    >
      {Math.round(confidence * 100)}%{low && <span> · review</span>}
    </span>
  )
}
