import { describe, expect, it } from 'vitest'
import { jevPercent, jevScore, needsReview } from './jev'

describe('jev helpers', () => {
  const jev = { c01: { a: 0.93 } }

  it('returns the stored score, 0 for a missing entry, and undefined when Jev has not loaded', () => {
    expect(jevScore(jev, 'c01', 'a')).toBe(0.93)
    expect(jevScore(jev, 'c01', 'b')).toBe(0)
    expect(jevScore(jev, 'c02', 'a')).toBe(0)
    expect(jevScore(undefined, 'c01', 'a')).toBeUndefined()
  })

  it('flags scores below 50% for review', () => {
    expect(needsReview(0.39)).toBe(true)
    expect(needsReview(0.5)).toBe(false)
  })

  it('formats percentages', () => {
    expect(jevPercent(0.934)).toBe('93%')
    expect(jevPercent(0.01)).toBe('<5%')
  })
})
