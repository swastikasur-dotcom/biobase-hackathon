/** Left edge of a hover card next to a point: to its right on the left half of the map, to its left on the right half, kept inside the map. */
export function cardLeft(x: number, containerWidth: number, cardWidth = 224, gap = 14): number {
  const left = x < containerWidth / 2 ? x + gap : x - gap - cardWidth
  return Math.max(0, Math.min(left, containerWidth - cardWidth))
}

/** Top edge of a hover card centred on a point, kept inside the map. */
export function cardTop(y: number, containerHeight: number, cardHeight = 250): number {
  return Math.max(0, Math.min(y - cardHeight / 2, containerHeight - cardHeight))
}
