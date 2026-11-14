import type { Slide } from '../types'

const TILE_PX = 254

export const tileUrl = (slideId: string, [col, row]: [number, number]) =>
  `${import.meta.env.BASE_URL}tiles20x/${slideId}/${col}_${row}.jpg`

/**
 * Approximate position of a tile on the slide, as fractions (0 to 1) of its width and height.
 * Per tiles20x/README.md a tile starts at col x 254 x 2^(N-L) px of the full-resolution scan,
 * where N-L is 1 for a 40x scan (0.25 um/px) and 0 for a 20x scan. Slides with no magnification
 * are assumed to be 40x, as the pack did. The result is approximate because the pack's um_per_px is.
 */
export function tilePosition(slide: Pick<Slide, 'width' | 'height' | 'magnification'>, [col, row]: [number, number]) {
  if (!slide.width || !slide.height) return null
  const scale = (slide.magnification ?? 40) >= 40 ? 2 : 1
  return {
    x: Math.min(1, (col * TILE_PX * scale) / slide.width),
    y: Math.min(1, (row * TILE_PX * scale) / slide.height),
  }
}
