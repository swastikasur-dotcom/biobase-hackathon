import { describe, expect, it } from 'vitest'
import { cardLeft, cardTop } from './hovercard'

describe('hover card placement', () => {
  it('opens to the right of a point on the left half and to the left on the right half', () => {
    expect(cardLeft(100, 600)).toBe(114)
    expect(cardLeft(500, 600)).toBe(500 - 14 - 224)
  })

  it('stays inside a narrow map', () => {
    expect(cardLeft(10, 260)).toBe(24) // fits as is
    expect(cardLeft(120, 260)).toBe(36) // would be 134, pulled back so the card ends at the right edge
    expect(cardLeft(250, 260)).toBe(12)
    expect(cardLeft(0, 100)).toBe(0) // card wider than the map: pinned to the left edge
  })

  it('centres vertically but never leaves the map', () => {
    expect(cardTop(300, 600)).toBe(175)
    expect(cardTop(10, 600)).toBe(0)
    expect(cardTop(590, 600)).toBe(350)
  })
})
