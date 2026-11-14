import type { Cohorts, Report } from '../types'

/**
 * Organ of each criterion, taken from the reports that match it (most common organ wins).
 * The criteria have no organ field of their own, and this avoids hard-coding id ranges.
 */
export function criterionOrgans(cohorts: Cohorts, reports: Map<string, Report>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [cid, ids] of Object.entries(cohorts)) {
    const counts = new Map<string, number>()
    for (const id of ids) {
      const organ = reports.get(id)?.fields.organ
      if (typeof organ === 'string') counts.set(organ, (counts.get(organ) ?? 0) + 1)
    }
    const top = [...counts].sort((a, b) => b[1] - a[1])[0]
    out[cid] = top ? top[0] : 'other'
  }
  return out
}

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Slide organ group for a report organ (the slide data uses different organ names). */
export const REPORT_ORGAN_TO_SLIDE_GROUP: Record<string, string> = {
  breast: 'Breast',
  colon: 'Colon and rectum',
  lung: 'Lung',
  prostate: 'Prostate',
  stomach: 'Stomach',
  kidney: 'Kidney',
  skin: 'Skin',
}
