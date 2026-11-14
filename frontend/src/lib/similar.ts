import type { Report } from '../types'

/**
 * Dataset reports that match the most of the same criteria as an analysed report.
 * Ties break by id so the list is stable. Reports sharing no criterion are never returned.
 */
export function similarReports(matchedIds: string[], reports: Report[], limit = 5): { report: Report; shared: string[] }[] {
  const wanted = new Set(matchedIds)
  return reports
    .map((report) => ({ report, shared: report.matches.filter((c) => wanted.has(c)) }))
    .filter((r) => r.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || a.report.id.localeCompare(b.report.id))
    .slice(0, limit)
}
