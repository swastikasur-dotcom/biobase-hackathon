import type { Slide } from '../types'

/** Below this, a prediction is flagged for human review. */
export const LOW_CONFIDENCE = 0.5

export const isLowConfidence = (c: number) => c < LOW_CONFIDENCE

/** Organ to show for a slide: the known group, else the predicted one. */
export function slideOrgan(s: Slide): { organ: string | undefined; predicted: boolean } {
  if (s.organGroup) return { organ: s.organGroup, predicted: false }
  return { organ: s.prediction?.organ, predicted: !!s.prediction }
}

export const thumbUrl = (id: string) => `${import.meta.env.BASE_URL}thumbnails/${id}.jpg`

/** Short label: SUPP-01-biobase_77b8a66e-... -> SUPP-01 · 77b8a66e, SUPP-02-bb_02_wsi_0176 -> SUPP-02 · 0176 */
export function shortId(id: string): string {
  const uuid = id.match(/^(SUPP-\d+)-biobase_([0-9a-f]{8})-/)
  if (uuid) return `${uuid[1]} · ${uuid[2]}`
  const numbered = id.match(/^(SUPP-\d+)-bb_\d+_wsi_(\d+)$/)
  return numbered ? `${numbered[1]} · ${numbered[2]}` : id
}

/**
 * Picks a held-out slide that has a prediction (these are the ones with C1 and C2 results).
 * `random` is injectable for tests. Pass `exclude` to avoid repeating the current pick.
 */
export function pickHeldoutSlide(slides: Slide[], random: () => number = Math.random, exclude?: string): Slide | undefined {
  const pool = slides.filter((s) => s.heldout && s.prediction)
  const choices = pool.length > 1 && exclude ? pool.filter((s) => s.id !== exclude) : pool
  return choices.length ? choices[Math.min(Math.floor(random() * choices.length), choices.length - 1)] : undefined
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}
