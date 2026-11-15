import type { TrialAssessment, TrialMatch } from '../types'

const DOT: Record<TrialAssessment, { label: string; dot: string }> = {
  likely_relevant: { label: 'Likely relevant', dot: 'bg-blue-700' },
  needs_more_information: { label: 'Needs information', dot: 'border-2 border-slate-400 bg-white' },
  not_a_match: { label: 'Excluded by profile', dot: 'bg-slate-300' },
}

/** The one line that says why this trial is where it is. */
function reason(m: TrialMatch): string {
  if (m.assessment === 'not_a_match') return m.exclusions[0] ?? 'The patient profile contradicts an eligibility requirement.'
  if (m.assessment === 'needs_more_information') {
    const n = m.clarification_questions.length
    return n > 0 ? `${n} question${n === 1 ? '' : 's'} to answer: ${m.clarification_questions[0].prompt}` : (m.unknown_requirements[0] ?? 'Some requirements are unknown.')
  }
  // "condition mentions breast" is true of every result, so lead with a more specific fact when there is one.
  const specific = m.matched_facts.find((f) => !/^condition mentions/i.test(f))
  return specific ?? m.matched_facts[0] ?? 'Matches the patient profile.'
}

/** One trial in the shortlist, compact enough to scan ten at a time. */
export default function TrialRow({ match, onOpen }: { match: TrialMatch; onOpen: () => void }) {
  const d = DOT[match.assessment]
  const site = match.nearest_site
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-start gap-3 bg-white px-4 py-3 text-left hover:bg-blue-50">
      <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${d.dot}`} title={d.label} aria-label={d.label} role="img" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug">{match.trial.title}</span>
        <span className="mt-1 block truncate text-sm text-slate-600">{reason(match)}</span>
        <span className="mt-1 block text-xs text-slate-500">
          <span className="font-mono">{match.nct_id}</span>
          {match.distance_miles != null && site && ` · ${site.city ?? 'nearest site'} · ${Math.round(match.distance_miles)} mi`}
        </span>
      </span>
      <span aria-hidden className="mt-1 text-slate-400 group-hover:text-blue-700">›</span>
    </button>
  )
}
