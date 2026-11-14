import { useEffect, useRef, useState, type ReactNode } from 'react'
import { thumbUrl } from '../lib/slides'
import { tileUrl } from '../lib/tiles'

// A fixed, high-confidence example so the drawings use real images from the dataset.
const EXAMPLE = 'SUPP-02-bb_02_wsi_0077' // predicted Kidney, confidence 1.00
const EXAMPLE_TILE: [number, number] = [14, 22]
const SIMILAR = ['SUPP-02-bb_02_wsi_0147', 'SUPP-02-bb_02_wsi_0088', 'SUPP-02-bb_02_wsi_0153']

const hide = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = 'hidden'
}

type Tone = 'plain' | 'soft' | 'strong'

const delay = (d: number) => ({ '--d': `${d}s` }) as React.CSSProperties

function Box({ x, y, w, h, title, sub, tone = 'plain', d = 0 }: { x: number; y: number; w: number; h: number; title: string; sub?: string; tone?: Tone; d?: number }) {
  const box = { plain: 'fill-white stroke-slate-300', soft: 'fill-slate-100 stroke-slate-300', strong: 'fill-slate-900 stroke-slate-900' }[tone]
  const head = tone === 'strong' ? 'fill-white' : 'fill-slate-900'
  const subtle = tone === 'strong' ? 'fill-slate-300' : 'fill-slate-500'
  return (
    <g className="svg-pop" style={delay(d)}>
      <rect x={x} y={y} width={w} height={h} rx={6} className={box} strokeWidth={1.25} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 5)} textAnchor="middle" className={`${head} text-[13px] font-semibold`}>
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className={`${subtle} text-[11px]`}>
          {sub}
        </text>
      )}
    </g>
  )
}

const Arrow = ({ d, t = 0 }: { d: string; t?: number }) => (
  <path d={d} pathLength={1} className="svg-draw fill-none stroke-slate-400" style={delay(t)} strokeWidth={1.5} markerEnd="url(#arrow)" />
)

const Defs = () => (
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" className="fill-slate-400" />
    </marker>
  </defs>
)

/** Task A: a report is read two ways and the answers are shown side by side. */
function DiagramA() {
  return (
    <svg viewBox="0 0 720 220" role="img" aria-label="A pathology report is read by rules and by Jev, giving matches and probabilities for 30 criteria" className="w-full min-w-[560px]">
      <Defs />
      {/* report page */}
      <rect x={10} y={40} width={110} height={140} rx={6} className="svg-pop fill-white stroke-slate-400" strokeWidth={1.5} />
      {[62, 76, 90, 104, 118, 132, 146].map((y, i) => (
        <rect key={y} x={24} y={y} width={i === 0 ? 60 : 82 - (i % 3) * 14} height={5} rx={2} className="svg-grow fill-slate-300" style={delay(0.08 * i)} />
      ))}
      <text x={65} y={30} textAnchor="middle" className="fill-slate-700 text-[12px] font-medium">Pathology report</text>
      <text x={65} y={198} textAnchor="middle" className="fill-slate-500 text-[11px]">free text</text>

      <Arrow d="M124 90 H166 V68 H186" t={0.3} />
      <Arrow d="M124 130 H166 V152 H186" t={0.3} />

      <Box x={190} y={36} w={250} h={64} title="Rules" sub="parse fields, then one rule per criterion" tone="plain" d={0.5} />
      <Box x={190} y={120} w={250} h={64} title="Jev" sub="reads the text and the criterion wording" tone="soft" d={0.6} />

      <Arrow d="M444 68 H494" t={0.85} />
      <Arrow d="M444 152 H494" t={0.95} />

      <Box x={498} y={36} w={212} h={64} title="Match / no match" sub="for each of 30 criteria" tone="plain" d={1.05} />
      <Box x={498} y={120} w={212} h={64} title="Probability 0-100%" sub="for each of 30 criteria" tone="soft" d={1.15} />
    </svg>
  )
}

/** Task C1: one slide becomes a vector of 1,536 numbers, then a classifier picks the organ. */
function DiagramC1() {
  return (
    <svg viewBox="190 0 530 130" role="img" aria-label="A slide becomes a GigaPath embedding, then logistic regression predicts one of 15 organs with a confidence" className="w-full min-w-[420px]">
      <Defs />
      <Box x={200} y={30} w={160} h={70} title="GigaPath" sub="slide embedding" tone="plain" d={0.1} />
      {/* the vector */}
      <Arrow d="M364 65 H402" t={0.4} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={408} y={14 + i * 8.6} width={34} height={7} rx={2} className="svg-grow fill-slate-500" style={delay(0.55 + i * 0.04)} opacity={0.25 + ((i * 37) % 10) / 14} />
      ))}
      <text x={425} y={124} textAnchor="middle" className="fill-slate-500 text-[11px]">1,536 numbers</text>
      <Arrow d="M448 65 H486" t={1.05} />
      <Box x={490} y={30} w={110} h={70} title="Logistic" sub="regression" tone="soft" d={1.2} />
      <Arrow d="M604 65 H630" t={1.45} />
      <Box x={634} y={30} w={80} h={70} title="Organ" sub="+ confidence" tone="strong" d={1.6} />
    </svg>
  )
}

/** Task C2: same-organ slides first, then ordered by similarity. */
function DiagramC2() {
  return (
    <svg viewBox="0 0 720 150" role="img" aria-label="Slides in the predicted organ are ranked first by embedding similarity, then all others" className="w-full min-w-[560px]">
      <Defs />
      <Box x={10} y={50} w={130} h={50} title="Query slide" sub="organ from C1" tone="strong" />
      <Arrow d="M144 75 H186" t={0.25} />
      <Box x={190} y={20} w={210} h={50} title="1. Same predicted organ" sub="ordered by GigaPath similarity" tone="soft" d={0.45} />
      <Box x={190} y={85} w={210} h={50} title="2. All other slides" sub="ordered by GigaPath similarity" tone="plain" d={0.6} />
      <Arrow d="M404 45 H466" t={0.9} />
      <Arrow d="M404 110 H466" t={1.0} />
      <Box x={470} y={50} w={240} h={50} title="Top 10 slides" sub="the same-organ group fills it first" tone="plain" d={1.15} />
    </svg>
  )
}

const Stat = ({ children }: { children: ReactNode }) => (
  <li className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">{children}</li>
)

function Section({ id, tag, title, children }: { id: string; tag: string; title: string; children: ReactNode }) {
  return (
    <section role="tabpanel" id={`models-panel-${id}`} aria-labelledby={`models-tab-${id}`} className="tab-enter px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tag}</p>
      <h3 className="mt-0.5 text-lg font-semibold">{title}</h3>
      {children}
    </section>
  )
}

const Img = ({ src, label, className = '' }: { src: string; label: string; className?: string }) => (
  <figure className="shrink-0">
    <img src={src} alt={label} onError={hide} className={`rounded border border-slate-200 bg-slate-50 object-cover ${className}`} />
    <figcaption className="mt-1 text-center text-[11px] text-slate-500">{label}</figcaption>
  </figure>
)

type TabId = 'a' | 'c1' | 'c2'
const TABS: { id: TabId; label: string }[] = [
  { id: 'a', label: 'Task A · Reports' },
  { id: 'c1', label: 'Task C1 · Organ' },
  { id: 'c2', label: 'Task C2 · Similar slides' },
]

/** Modal that explains the models behind the three tasks. */
export default function ModelsModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<TabId>('a')
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="models-h"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 id="models-h" className="text-xl font-semibold">
            About the models
          </h2>
          <p className="mt-1 text-sm text-slate-600">How each task reaches its answer, and how well it did on labelled data.</p>
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="Close About the models"
          className="rounded px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
      </header>

      <div role="tablist" aria-label="Models by task" className="sticky top-[4.5rem] z-10 flex gap-1 border-b border-slate-200 bg-white px-4 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`models-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`models-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'a' && (
        <Section id="a" tag="Task A · find patients" title="Two readers for every report">
        <p className="mt-2 text-sm text-slate-700">
          Each of the 979 pathology reports is checked against 30 trial criteria in two independent ways, so you can see where
          they agree. <strong>Rules</strong> first turn the report into fields (organ, stage, margins, biomarkers…) and apply one
          hand-written rule per criterion. <strong>Jev</strong>, a model that returns typed decisions with calibrated
          probabilities, reads the raw text and the plain-English criterion and answers yes or no for each of the 30, as a
          probability.
        </p>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white p-2">
          <DiagramA />
        </div>
        <ul className="stagger mt-3 flex flex-wrap gap-2">
          <Stat>Rules: F1 1.000 on 9,010 training reports</Stat>
          <Stat>Jev agrees on 29,365 of 29,370 decisions</Stat>
          <Stat>Jev under 50% on a match → “review”</Stat>
        </ul>
      </Section>

      )}
      {tab === 'c1' && (
        <Section id="c1" tag="Task C1 · organ of a slide" title="A slide fingerprint and a simple classifier">
        <p className="mt-2 text-sm text-slate-700">
          <strong>GigaPath</strong>, a pathology foundation model, condenses each whole slide into one list of 1,536 numbers. A
          <strong> logistic regression</strong> trained on the 188 labelled slides then picks one of 15 organ groups and gives its
          confidence. Predictions under 50% confidence are flagged for manual review.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 overflow-x-auto rounded border border-slate-200 bg-white p-3">
          <div className="stagger flex gap-3">
            <Img src={thumbUrl(EXAMPLE)} label="Whole slide" className="h-24 w-24" />
            <Img src={tileUrl(EXAMPLE, EXAMPLE_TILE)} label="One 20x tile" className="h-24 w-24" />
            <span aria-hidden className="mt-9 text-slate-400">→</span>
          </div>
          <div className="min-w-0 flex-1">
            <DiagramC1 />
          </div>
        </div>
        <ul className="stagger mt-3 flex flex-wrap gap-2">
          <Stat>87.4% accuracy (leave-one-out)</Stat>
          <Stat>Copying the nearest slide: 77.9%</Stat>
          <Stat>Other models and metadata did not help</Stat>
        </ul>
      </Section>

      )}
      {tab === 'c2' && (
        <Section id="c2" tag="Task C2 · most similar slides" title="Same organ first, then closest look">
        <p className="mt-2 text-sm text-slate-700">
          Slides are compared by the distance between their GigaPath fingerprints. To keep the results anatomically sensible, slides in
          the query’s <strong>predicted organ</strong> come first, ordered by similarity, then everything else. A wrong C1
          prediction therefore pulls in the wrong slides.
        </p>
        <div className="mt-3 rounded border border-slate-200 bg-white p-3">
          <div className="stagger flex flex-wrap items-start gap-3">
            <Img src={thumbUrl(EXAMPLE)} label="Query (Kidney)" className="h-20 w-20 ring-2 ring-slate-900" />
            <span aria-hidden className="mt-8 text-slate-400">→</span>
            {SIMILAR.map((id, i) => (
              <Img key={id} src={thumbUrl(id)} label={`#${i + 1}`} className="h-20 w-20" />
            ))}
            <span className="mt-8 text-sm text-slate-400">…</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <DiagramC2 />
          </div>
        </div>
        <ul className="stagger mt-3 flex flex-wrap gap-2">
          <Stat>Precision@10: 0.83 (plain similarity: 0.45)</Stat>
          <Stat>Precision@1: 0.87</Stat>
        </ul>
      </Section>

      )}

      <footer className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Accuracy figures are leave-one-out checks on labelled data; the test reports and slides have no public answer key. Research
        prototype, not for clinical use.
      </footer>
    </dialog>
  )
}
