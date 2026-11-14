import { describe, expect, it } from 'vitest'
import { isLowConfidence, shortId, slideOrgan } from './slides'

describe('slides helpers', () => {
  it('flags confidence below 0.5 only', () => {
    expect(isLowConfidence(0.49)).toBe(true)
    expect(isLowConfidence(0.5)).toBe(false)
  })

  it('prefers the known organ over the prediction', () => {
    expect(slideOrgan({ id: 'a', heldout: false, organGroup: 'Breast' })).toEqual({ organ: 'Breast', predicted: false })
    expect(slideOrgan({ id: 'b', heldout: true, prediction: { organ: 'Lung', confidence: 0.9 } })).toEqual({ organ: 'Lung', predicted: true })
    expect(slideOrgan({ id: 'c', heldout: true })).toEqual({ organ: undefined, predicted: false })
  })

  it('shortens uuid and numbered slide ids', () => {
    expect(shortId('SUPP-01-biobase_77b8a66e-116e-494c-a2d1-5ab7a565d79d')).toBe('SUPP-01 · 77b8a66e')
    expect(shortId('SUPP-02-bb_02_wsi_0176')).toBe('SUPP-02 · 0176')
    expect(shortId('something-else')).toBe('something-else')
  })
})

import { formatBytes, pickHeldoutSlide } from './slides'
import type { Slide } from '../types'

const slide = (id: string, heldout: boolean, withPrediction = true): Slide => ({
  id,
  heldout,
  ...(withPrediction ? { prediction: { organ: 'Lung', confidence: 0.9 } } : {}),
})

describe('pickHeldoutSlide', () => {
  const slides = [slide('a', true), slide('b', true), slide('lab', false), slide('nopred', true, false)]

  it('only picks held-out slides that have a prediction', () => {
    for (const r of [0, 0.5, 0.999]) expect(['a', 'b']).toContain(pickHeldoutSlide(slides, () => r)?.id)
  })

  it('is deterministic for a given random value', () => {
    expect(pickHeldoutSlide(slides, () => 0)?.id).toBe('a')
    expect(pickHeldoutSlide(slides, () => 0.99)?.id).toBe('b')
  })

  it('avoids the excluded slide when there is another choice', () => {
    expect(pickHeldoutSlide(slides, () => 0, 'a')?.id).toBe('b')
  })

  it('keeps the only candidate even if excluded, and returns undefined when none', () => {
    expect(pickHeldoutSlide([slide('a', true)], () => 0, 'a')?.id).toBe('a')
    expect(pickHeldoutSlide([slide('x', false)])).toBeUndefined()
  })
})

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.0 MB')
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.5 GB')
  })
})
