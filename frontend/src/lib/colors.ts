/** Evenly spaced hues for categorical series (organ groups). Not colour-blind-proof on its own: pair with labels. */
export function categoryColor(index: number, total: number): string {
  return `hsl(${Math.round((index / Math.max(total, 1)) * 360)} 65% 45%)`
}
