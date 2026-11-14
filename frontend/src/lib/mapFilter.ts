import type { Slide } from '../types'
import { isLowConfidence, shortId, slideOrgan } from './slides'

export type Scope = 'all' | 'labelled' | 'heldout' | 'review'

export const SCOPES: { value: Scope; label: string; hint: string }[] = [
  { value: 'all', label: 'All', hint: 'Every slide on the map' },
  { value: 'labelled', label: 'Labelled', hint: 'Organ known from the labels' },
  { value: 'heldout', label: 'Held-out', hint: 'Organ predicted by the model' },
  { value: 'review', label: 'Needs review', hint: 'Predicted with under 50% confidence' },
]

export interface MapFilters {
  scope: Scope
  /** Selected organ groups. Empty means every organ. */
  organs: Set<string>
  /** '' means any. */
  supplier: string
  stain: string
  /** Free text matched against the slide id, its short label, organ and diagnosis. */
  q: string
}

export const noFilters: MapFilters = { scope: 'all', organs: new Set(), supplier: '', stain: '', q: '' }

export const hasFilters = (f: MapFilters) =>
  f.scope !== 'all' || f.organs.size > 0 || f.supplier !== '' || f.stain !== '' || f.q.trim() !== ''

function inScope(s: Slide, scope: Scope): boolean {
  if (scope === 'labelled') return !s.heldout
  if (scope === 'heldout') return s.heldout
  if (scope === 'review') return s.heldout && !!s.prediction && isLowConfidence(s.prediction.confidence)
  return true
}

/** Everything except the organ selection, so organ chips can show how many slides each would add. */
export function matchesOtherFilters(s: Slide, f: MapFilters): boolean {
  if (!inScope(s, f.scope)) return false
  if (f.supplier && s.supplierId !== f.supplier) return false
  if (f.stain && s.stain !== f.stain) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    const hay = `${s.id} ${shortId(s.id)} ${slideOrgan(s).organ ?? ''} ${s.diagnosis ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

export function matchesFilters(s: Slide, f: MapFilters): boolean {
  if (!matchesOtherFilters(s, f)) return false
  if (f.organs.size === 0) return true
  const organ = slideOrgan(s).organ
  return !!organ && f.organs.has(organ)
}

/** Slides per organ among those passing every filter except the organ selection. */
export function organCounts(slides: Slide[], f: MapFilters): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of slides) {
    if (!matchesOtherFilters(s, f)) continue
    const organ = slideOrgan(s).organ
    if (organ) counts.set(organ, (counts.get(organ) ?? 0) + 1)
  }
  return counts
}

const isScope = (v: string | null): v is Scope => SCOPES.some((s) => s.value === v)

/** Filters <-> URL query string, so a filtered view can be shared or survive a reload. */
export function filtersFromParams(p: URLSearchParams): MapFilters {
  const scope = p.get('scope')
  return {
    scope: isScope(scope) ? scope : 'all',
    organs: new Set((p.get('organs') ?? '').split('|').filter(Boolean)),
    supplier: p.get('supplier') ?? '',
    stain: p.get('stain') ?? '',
    q: p.get('q') ?? '',
  }
}

export function paramsFromFilters(f: MapFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.scope !== 'all') p.set('scope', f.scope)
  if (f.organs.size) p.set('organs', [...f.organs].join('|'))
  if (f.supplier) p.set('supplier', f.supplier)
  if (f.stain) p.set('stain', f.stain)
  if (f.q.trim()) p.set('q', f.q.trim())
  return p
}
