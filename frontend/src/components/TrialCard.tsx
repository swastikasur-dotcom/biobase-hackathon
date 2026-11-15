import { useMutation } from '@tanstack/react-query'
import { researchTrial } from '../data/trials'
import type { Answer, TrialAnswers, TrialAssessment, TrialMatch } from '../types'

const BADGE: Record<TrialAssessment, { label: string; className: string }> = {
  likely_relevant: { label: 'Likely relevant', className: 'bg-blue-700 text-white' },
  needs_more_information: { label: 'Needs information', className: 'border border-slate-400 text-slate-800' },
  not_a_match: { label: 'Excluded by profile', className: 'bg-slate-200 text-slate-600' },
}

const ANSWERS: { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Not sure' },
]

const CATEGORY: Record<string, string> = {
  recruitment_or_site: 'Recruitment or site',
  publication_or_protocol: 'Publication or protocol',
  sponsor_update: 'Sponsor update',
  other_public_context: 'Other public context',
}

function Sources({ match }: { match: TrialMatch }) {
  const research = useMutation({ mutationFn: () => researchTrial(match.trial) })
  return (
    <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Independent public sources</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Looks for recruitment contacts, protocols and sponsor updates that mention this NCT id. Only the NCT id is sent, never patient
            information.
          </p>
        </div>
        <button
          type="button"
          onClick={() => research.mutate()}
          disabled={research.isPending}
          className="shrink-0 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          {research.isPending ? 'Searching…' : research.data ? 'Search again' : 'Find public sources'}
        </button>
      </div>
      {research.isError && (
        <p role="alert" className="mt-2 text-sm text-slate-700">
          {research.error.message}
        </p>
      )}
      {research.data &&
        (research.data.sources.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No public page mentioning {match.nct_id} with usable detail was found.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {research.data.sources.map((s) => (
              <li key={s.url} className="text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">{CATEGORY[s.category] ?? s.category}</p>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-900">
                  {s.title} ↗
                </a>
                <blockquote className="mt-1 border-l-2 border-slate-300 pl-3 text-slate-700">“{s.evidence_quote}”</blockquote>
              </li>
            ))}
          </ul>
        ))}
      {research.data && <p className="mt-2 text-xs text-slate-500">{research.data.review_note}</p>}
    </div>
  )
}

export default function TrialCard({
  match,
  answers,
  onAnswer,
  busy,
}: {
  match: TrialMatch
  answers: TrialAnswers[string] | undefined
  onAnswer: (nctId: string, questionId: string, answer: Answer) => void
  busy: boolean
}) {
  const badge = BADGE[match.assessment]
  const t = match.trial
  const site = match.nearest_site
  return (
    <article aria-label={`Trial ${match.nct_id}`} className="lift rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
        <a
          href={t.official_url ?? match.source_url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-blue-700 hover:underline"
        >
          {match.nct_id} ↗
        </a>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug">{t.title}</h3>
      {t.conditions.length > 0 && <p className="mt-1 text-sm text-slate-500">{t.conditions.slice(0, 5).join(' · ')}</p>}

      {match.matched_facts.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</h4>
          <ul className="mt-1 space-y-0.5 text-sm">
            {match.matched_facts.map((f) => (
              <li key={f}>
                <span aria-hidden className="mr-2 text-slate-900">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.exclusions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why the profile does not fit</h4>
          <ul className="mt-1 space-y-0.5 text-sm">
            {match.exclusions.map((f) => (
              <li key={f}>
                <span aria-hidden className="mr-2">✕</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.clarification_questions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs a human answer</h4>
          <ul className="mt-2 space-y-3">
            {match.clarification_questions.map((q) => (
              <li key={q.question_id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium">{q.prompt}</p>
                <p className="mt-1 text-slate-600">Trial says: “{q.criterion_evidence}”</p>
                <p className="mt-1 text-xs text-slate-500">
                  Yes: {q.yes_effect} · No: {q.no_effect}
                </p>
                <div role="group" aria-label={q.prompt} className="mt-2 flex gap-1">
                  {ANSWERS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      disabled={busy}
                      aria-pressed={answers?.[q.question_id] === a.value}
                      onClick={() => onAnswer(match.nct_id, q.question_id, a.value)}
                      className={`rounded border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                        answers?.[q.question_id] === a.value ? 'border-slate-900 bg-blue-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-100'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.distance_miles != null && site && (
        <p className="mt-4 text-sm text-slate-600">
          Nearest site: {[site.facility, site.city, site.state].filter(Boolean).join(', ')} · about {Math.round(match.distance_miles)} miles
        </p>
      )}

      <Sources match={match} />

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">Official eligibility text</summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs">
          {t.eligibility_text ?? 'Not published.'}
        </pre>
      </details>

      <p className="mt-4 text-xs text-slate-500">
        Registry status {t.status.replace(/_/g, ' ').toLowerCase()}
        {t.last_update_posted ? ` · updated ${t.last_update_posted}` : ''}. {match.review_note}
      </p>
    </article>
  )
}
