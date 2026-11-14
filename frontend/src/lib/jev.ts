import type { JevFile } from '../types'

/** Jev says "yes" at 50%. Matches the rules found but scored lower are worth a manual look. */
export const JEV_REVIEW_BELOW = 0.5

/** Jev's probability that a report meets a criterion; entries below 5% are not stored, so they read as 0. */
export const jevScore = (jev: JevFile | undefined, criterionId: string, reportId: string): number | undefined =>
  jev ? (jev[criterionId]?.[reportId] ?? 0) : undefined

export const needsReview = (p: number) => p < JEV_REVIEW_BELOW

export const jevPercent = (p: number) => (p < 0.05 ? '<5%' : `${Math.round(p * 100)}%`)
