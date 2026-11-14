import { describe, expect, it } from 'vitest'
import { tilePosition } from './tiles'

describe('tilePosition', () => {
  it('doubles the pixel offset for 40x scans', () => {
    expect(tilePosition({ width: 10160, height: 10160, magnification: 40 }, [10, 5])).toEqual({ x: 0.5, y: 0.25 })
  })

  it('uses the plain offset for 20x scans', () => {
    expect(tilePosition({ width: 5080, height: 5080, magnification: 20 }, [10, 5])).toEqual({ x: 0.5, y: 0.25 })
  })

  it('assumes 40x when magnification is missing, and clamps to 1', () => {
    expect(tilePosition({ width: 100, height: 100 }, [10, 10])).toEqual({ x: 1, y: 1 })
  })

  it('returns null without slide dimensions', () => {
    expect(tilePosition({}, [1, 1])).toBeNull()
  })
})
