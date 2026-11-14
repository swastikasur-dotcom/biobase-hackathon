import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { thumbUrl } from '../lib/slides'

const d = (s: number) => ({ '--d': `${s}s` }) as React.CSSProperties

/** The product at work: a pathology report is read, and the facts that decide eligibility are picked out. */
function ReportDemo() {
  return (
    <figure className="rounded-xl bg-[var(--glass)] p-4 sm:p-6" aria-label="Example: a pathology report is read into a patient profile">
      <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg bg-white p-4 shadow-[0_1px_0_var(--rule)]">
          <p className="text-sm font-semibold text-[var(--muted)]">Pathology report</p>
          <p className="mono mt-3 text-[13px] leading-7">
            FINAL DIAGNOSIS: <span className="hl" style={d(0.6)}>Invasive ductal carcinoma</span>, Nottingham{' '}
            <span className="hl" style={d(1.0)}>grade 3</span>. Margins negative.
            <br />
            <span className="hl" style={d(1.4)}>ER negative</span>, <span className="hl" style={d(1.7)}>PR negative</span>,{' '}
            <span className="hl" style={d(2.0)}>HER2 negative</span> (IHC 0).
            <br />
            Patient: female, <span className="hl" style={d(2.3)}>50–59</span>.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="verdict rounded-lg bg-white p-4 shadow-[0_1px_0_var(--rule)]" style={d(2.7)}>
            <p className="text-sm font-semibold text-[var(--muted)]">Patient profile</p>
            <p className="mt-2 text-lg font-semibold leading-snug">Breast, triple-negative ductal, grade 3, female, 50s</p>
          </div>
          <div className="verdict rounded-lg bg-[var(--hema)] p-4 text-white" style={d(3.2)}>
            <p className="text-sm font-semibold opacity-80">Open trial</p>
            <p className="mt-1 font-semibold">Likely relevant</p>
            <p className="mt-2 text-sm leading-snug opacity-90">✓ ER, PR and HER2 all negative: matches the triple-negative requirement</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-[var(--muted)]">Illustration of the Find trials flow, using a synthetic report.</figcaption>
    </figure>
  )
}

const CHECKS = [
  {
    q: 'Are these the right patients?',
    went: 'Eligibility problems in 12 FDA letters and subtype, stage or biomarker problems in 11',
    how: 'Reads each pathology report against 30 trial criteria and lists exactly who qualifies.',
    proof: 'F1 = 1.00 on 9,010 practice reports',
    to: '/patients',
    cta: 'Browse patient cohorts',
  },
  {
    q: 'Is the group consistent?',
    went: 'Mixed patient group, including mixed tissue types, in 5 letters',
    how: 'Confirms each slide comes from the organ its report says, and how sure the model is.',
    proof: '87% organ accuracy (baseline 78%)',
    to: '/slides',
    cta: 'Explore slides',
    thumb: true,
  },
  {
    q: 'Is the comparison matched?',
    went: 'Comparison group did not match in 13 letters',
    how: 'Measures how alike a group’s tissue is and finds look-alike patients for the comparison arm.',
    proof: '83% of top-10 look-alikes share the organ (baseline 45%)',
    to: '/slides/map',
    cta: 'Open the slide map',
  },
]

export default function Home() {
  useDocumentTitle('')
  return (
    <div className="landing -mt-2">
      {/* ---------- Hero ---------- */}
      <section className="grid items-center gap-10 py-10 lg:grid-cols-[1fr_1.15fr] lg:py-16">
        <div>
          <p className="font-semibold text-[var(--hema)]">Trial Readiness Check</p>
          <h1 className="mt-3 max-w-[14ch] text-5xl font-extrabold leading-[1.02] sm:text-6xl">Know who qualifies before the trial starts.</h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[var(--muted)]">
            Read pathology reports and tissue slides against a trial’s eligibility criteria, so patient problems show up before
            enrolment, not in an FDA rejection letter.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/patients/match" className="btn btn-solid">Find trials for a patient</Link>
            <Link to="/patients/analyze" className="btn btn-line">Analyse a report</Link>
          </div>
        </div>
        <ReportDemo />
      </section>

      {/* ---------- Why ---------- */}
      <section aria-labelledby="why-h" className="grid gap-8 py-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <h2 id="why-h" className="max-w-[16ch] text-3xl font-semibold leading-tight sm:text-4xl">
          Who can join a trial comes down to one pathologist’s read.
        </h2>
        <div>
          <p className="max-w-[56ch] text-lg leading-relaxed text-[var(--muted)]">
            A slide from the patient’s tumor is read for grade, subtype, HER2 and stage. That report decides who is enrolled, and
            the read is not always right.
          </p>
          <dl className="mt-6">
            {[
              ['1 in 4', 'breast-biopsy diagnoses by 115 U.S. pathologists disagreed with an expert panel.', 'Elmore et al., JAMA 2015'],
              ['18%', 'of local HER2 results that made patients eligible for a trastuzumab trial failed central re-testing.', 'Paik et al., JNCI 2002'],
              ['7%', 'of 456 FDA rejection letters criticize who was studied; 12.7% of letters for cancer drugs.', 'our analysis of the RayCaster dataset'],
            ].map(([n, t, src]) => (
              <div key={n} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-4 border-t border-[var(--rule)] py-4 sm:grid-cols-[7rem_1fr]">
                <dt className="text-3xl font-extrabold tabular-nums sm:text-4xl">{n}</dt>
                <dd>
                  {t} <span className="text-sm text-[var(--muted)]">{src}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- The checks ---------- */}
      <section aria-labelledby="checks-h" className="py-12">
        <h2 id="checks-h" className="max-w-[24ch] text-3xl font-semibold leading-tight sm:text-4xl">
          Three checks to run before you enrol.
        </h2>
        <p className="mt-3 max-w-[60ch] text-lg text-[var(--muted)]">
          Each one answers something FDA reviewers have flagged. Each is tested on its own Biobase task.
        </p>
        <div className="mt-8">
          {CHECKS.map((c) => (
            <Link key={c.q} to={c.to} className="check-row grid gap-3 py-6 lg:grid-cols-[1.1fr_1.5fr_1fr_11rem] lg:items-start lg:gap-8">
              <div>
                <h3 className="text-2xl font-semibold leading-snug">{c.q}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{c.went}</p>
              </div>
              <p className="leading-relaxed">{c.how}</p>
              <p className="font-semibold">{c.proof}</p>
              <span className="flex items-center gap-3 font-semibold text-[var(--hema)]">
                {c.thumb && (
                  <img
                    src={thumbUrl('SUPP-02-bb_02_wsi_0077')}
                    alt=""
                    className="h-12 w-12 rounded object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                {c.cta}
              </span>
            </Link>
          ))}
          <div className="border-t border-[var(--ink)]" />
        </div>
        <p className="mt-4 max-w-[70ch] text-xs text-[var(--muted)]">
          FDA letters counted out of 456; one letter can raise several issues. The combined check is our proposal, and no FDA letter
          mentions AI pathology tools. Source: RayCaster Complete Response Letter pack, analysed by our team.
        </p>
      </section>

      {/* ---------- Start ---------- */}
      <section aria-labelledby="start-h" className="mt-6 rounded-2xl bg-[var(--hema)] px-6 py-12 text-white sm:px-12">
        <h2 id="start-h" className="max-w-[20ch] text-3xl font-semibold leading-tight sm:text-4xl">
          Start with one report.
        </h2>
        <p className="mt-3 max-w-[52ch] text-lg text-white/80">
          Paste a pathology report to see its patient profile and the open trials it could fit, or upload a slide to see its organ.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/patients/match" className="btn bg-white text-[var(--hema)] hover:bg-[var(--eosin-soft)]">Find trials for a patient</Link>
          <Link to="/patients/analyze" className="btn text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.7)] hover:bg-white/10">Analyse a report</Link>
          <Link to="/slides" className="btn text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.7)] hover:bg-white/10">Upload a slide</Link>
        </div>
      </section>
    </div>
  )
}
