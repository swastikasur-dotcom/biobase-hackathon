import { Link } from 'react-router-dom'
import JevBadge from './JevBadge'
import { JEV_REVIEW_BELOW } from '../lib/jev'
import { useReports } from '../data/api'
import { REPORT_ORGAN_TO_SLIDE_GROUP, titleCase } from '../lib/organs'
import { similarReports } from '../lib/similar'
import type { AnalysisResult, CriterionResult } from '../types'

const META = new Set(['sex', 'age_band', 'report_year', 'specimen', 'organ'])

function Evidence({ item }: { item: CriterionResult }) {
  return (
    <dl className="mt-2 space-y-1 text-sm">
      {item.evidence.map((e) => (
        <div key={e.field} className="flex gap-2">
          <dt className="shrink-0 text-slate-500">{e.field}:</dt>
          <dd>{e.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function AnalysisResultView({ result }: { result: AnalysisResult }) {
  const reports = useReports()
  const similar = similarReports(
    result.matches.map((m) => m.id),
    reports.data ?? [],
  )
  const slideGroup = REPORT_ORGAN_TO_SLIDE_GROUP[result.organ]
  const jev = result.jev
  const ruleIds = new Set(result.matches.map((m) => m.id))
  // Criteria Jev says yes to (>= 50%), most confident first, with the ones the rules also matched marked.
  const jevYes = jev
    ? Object.entries(jev)
        .filter(([, p]) => p >= JEV_REVIEW_BELOW)
        .sort((a, b) => b[1] - a[1])
    : []
  const bothCount = jevYes.filter(([id]) => ruleIds.has(id)).length
  const texts = new Map([...result.matches, ...result.not_matched].map((c) => [c.id, c.text]))

  return (
    <div className="stagger space-y-8">
      {result.warnings.length > 0 && (
        <ul role="status" className="space-y-1 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <section aria-labelledby="summary-h">
        <h2 id="summary-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Summary
        </h2>
        <div className="rounded border border-slate-200 bg-white p-4">
          <span className="mb-2 inline-block rounded-full bg-blue-700 px-2.5 py-0.5 text-xs font-medium text-white">
            {titleCase(result.organ)}
          </span>
          <p className="leading-relaxed">{result.summary}</p>
          {jev && (
            <p className="mt-2 leading-relaxed">
              Jev says yes to {jevYes.length} criteri{jevYes.length === 1 ? 'on' : 'a'}; {bothCount} of them also match the rules
              {result.matches.length > bothCount
                ? `, and ${result.matches.length - bothCount} rule match${result.matches.length - bothCount === 1 ? '' : 'es'} Jev is unsure about.`
                : '.'}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Generated from the fields read from the report, not a clinical interpretation.
          </p>
        </div>
      </section>

      <section aria-labelledby="matches-h">
        <h2 id="matches-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Matches {result.matches.length} criteri{result.matches.length === 1 ? 'on' : 'a'}
        </h2>
        {result.matches.length === 0 ? (
          <p className="rounded border border-slate-200 bg-white p-4 text-slate-600">
            This report meets none of the 30 search criteria. The criteria it was checked against for {result.organ} are listed
            below.
          </p>
        ) : (
          <ul className="stagger space-y-3">
            {result.matches.map((m) => (
              <li key={m.id} className="rounded border border-emerald-300 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <p>
                    <span className="mr-2 font-mono text-xs text-slate-500">{m.id}</span>
                    {m.text}
                    {jev && (
                      <span className="ml-2 align-middle">
                        <JevBadge p={jev[m.id] ?? 0} />
                      </span>
                    )}
                  </p>
                  <Link to={`/patients/${m.id}`} className="shrink-0 text-sm text-blue-700 hover:underline">
                    See cohort
                  </Link>
                </div>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Why it matched: fields the rule reads</p>
                <Evidence item={m} />
              </li>
            ))}
          </ul>
        )}
        {result.not_matched.length > 0 && (
          <details className="mt-3 rounded border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Not matched: {result.not_matched.length} other {result.organ} criteri
              {result.not_matched.length === 1 ? 'on' : 'a'}
            </summary>
            <ul className="mt-3 space-y-3">
              {result.not_matched.map((m) => (
                <li key={m.id} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                  <p>
                    <span className="mr-2 font-mono text-xs text-slate-500">{m.id}</span>
                    {m.text}
                  </p>
                  <Evidence item={m} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="jev-h">
        <h2 id="jev-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Jev
        </h2>
        {!jev ? (
          <p role="status" className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {result.jev_error ?? 'Jev was not asked.'} The rule results above are unaffected.
          </p>
        ) : jevYes.length === 0 ? (
          <p className="rounded border border-slate-200 bg-white p-4 text-slate-600">Jev does not think this report meets any of the 30 criteria.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
            {jevYes.map(([id, p]) => (
              <li key={id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  <span className="mr-2 font-mono text-xs text-slate-500">{id}</span>
                  {texts.get(id) ?? ''}
                  <span className={`ml-2 text-xs ${ruleIds.has(id) ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {ruleIds.has(id) ? 'rules agree' : 'rules do not match'}
                  </span>
                </span>
                <JevBadge p={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="similar-h">
        <h2 id="similar-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Similar reports in the dataset
        </h2>
        {result.matches.length === 0 ? (
          <p className="text-sm text-slate-500">No matched criteria, so there is nothing to compare against.</p>
        ) : reports.isPending ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : similar.length === 0 ? (
          <p className="text-sm text-slate-500">No dataset report matches the same criteria.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
            {similar.map(({ report, shared }) => (
              <li key={report.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <Link to={`/patients/${shared[0]}/${report.id}`} className="font-mono text-blue-700 hover:underline">
                  {report.id}
                </Link>
                <span className="text-slate-600">
                  shares {shared.length} of your {result.matches.length}: {shared.join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {slideGroup && (
        <section aria-labelledby="slides-h">
          <h2 id="slides-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Related slides
          </h2>
          <p className="text-sm text-slate-600">
            <Link to={`/slides?organ=${encodeURIComponent(slideGroup)}`} className="text-blue-700 hover:underline">
              Browse {slideGroup} slides
            </Link>
            . This links by organ only: reports and slides come from separate datasets, so these are not this patient's
            slides.
          </p>
        </section>
      )}

      <section aria-labelledby="fields-h">
        <h2 id="fields-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Fields read from the report
        </h2>
        <dl className="grid gap-x-6 gap-y-2 rounded border border-slate-200 bg-white p-3 text-sm sm:grid-cols-2">
          {Object.entries(result.fields)
            .sort(([a], [b]) => Number(META.has(b)) - Number(META.has(a)))
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd>{v == null ? '—' : String(v)}</dd>
              </div>
            ))}
        </dl>
      </section>
    </div>
  )
}
