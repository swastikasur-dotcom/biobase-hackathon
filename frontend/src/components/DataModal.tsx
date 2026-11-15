import { useEffect, useRef, useState, type ReactNode } from 'react'
import { thumbUrl } from '../lib/slides'
import { tileUrl } from '../lib/tiles'

const EXAMPLE = 'SUPP-02-bb_02_wsi_0077'
const TILES: [number, number][] = [
  [14, 22],
  [14, 26],
  [14, 30],
  [18, 10],
]
const OTHERS = ['SUPP-02-bb_02_wsi_0147', 'SUPP-02-bb_02_wsi_0088', 'SUPP-01-biobase_77b8a66e-116e-494c-a2d1-5ab7a565d79d']

const hide = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = 'hidden'
}

const Img = ({ src, label, className = '' }: { src: string; label: string; className?: string }) => (
  <figure className="shrink-0">
    <img src={src} alt={label} onError={hide} className={`rounded border border-slate-200 bg-slate-50 object-cover ${className}`} />
    <figcaption className="mt-1 text-center text-[11px] text-slate-500">{label}</figcaption>
  </figure>
)

const Stat = ({ n, children }: { n: string; children: ReactNode }) => (
  <li className="rounded border border-slate-200 bg-white px-3 py-2">
    <p className="text-xl font-semibold tabular-nums">{n}</p>
    <p className="text-xs text-slate-600">{children}</p>
  </li>
)

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section role="tabpanel" id={`data-panel-${id}`} aria-labelledby={`data-tab-${id}`} className="tab-enter px-5 py-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** Reports and slides sit side by side with no line between them. */
function SeparateDiagram() {
  return (
    <svg viewBox="0 0 640 150" role="img" aria-label="Reports and slides are two separate sets with no link between a report and a slide" className="w-full min-w-[480px]">
      <g className="svg-pop">
        <rect x={10} y={20} width={250} height={110} rx={8} className="fill-white stroke-slate-300" strokeWidth={1.25} />
        <text x={135} y={52} textAnchor="middle" className="fill-slate-900 text-[14px] font-semibold">979 pathology reports</text>
        <text x={135} y={74} textAnchor="middle" className="fill-slate-500 text-[11px]">synthetic text, 30 criteria</text>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={50 + i * 36} y={92} width={26} height={22} rx={3} className="fill-slate-200" />
        ))}
      </g>
      <g className="svg-pop" style={{ '--d': '0.3s' } as React.CSSProperties}>
        <rect x={380} y={20} width={250} height={110} rx={8} className="fill-slate-100 stroke-slate-300" strokeWidth={1.25} />
        <text x={505} y={52} textAnchor="middle" className="fill-slate-900 text-[14px] font-semibold">263 whole slides</text>
        <text x={505} y={74} textAnchor="middle" className="fill-slate-500 text-[11px]">real tissue, 15 organ groups</text>
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={420 + i * 36} cy={103} r={11} className="fill-[#e7b3c6]" />
        ))}
      </g>
      <g className="svg-pop" style={{ '--d': '0.6s' } as React.CSSProperties}>
        <path d="M268 75 H372" className="stroke-slate-400" strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
        <circle cx={320} cy={75} r={13} className="fill-white stroke-slate-500" strokeWidth={1.5} />
        <path d="M314 69 L326 81 M326 69 L314 81" className="stroke-slate-700" strokeWidth={2} fill="none" />
        <text x={320} y={112} textAnchor="middle" className="fill-slate-600 text-[11px]">no link</text>
      </g>
    </svg>
  )
}

type TabId = 'reports' | 'slides' | 'limits'
const TABS: { id: TabId; label: string }[] = [
  { id: 'reports', label: 'Reports' },
  { id: 'slides', label: 'Slides' },
  { id: 'limits', label: 'What to keep in mind' },
]

/** Modal that explains the data behind the app: what it is, what it contains and what it cannot tell you. */
export default function DataModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<TabId>('reports')
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="data-h"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 id="data-h" className="text-xl font-semibold">
            About the data
          </h2>
          <p className="mt-1 text-sm text-slate-600">What the reports and slides are, and what they can and cannot tell you.</p>
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="Close About the data"
          className="rounded px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
      </header>

      <div role="tablist" aria-label="Data by kind" className="sticky top-[4.5rem] z-10 flex gap-1 border-b border-slate-200 bg-white px-4 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`data-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`data-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? 'border-blue-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <Section id="reports" title="Synthetic pathology reports">
          <p className="mt-2 text-sm text-slate-700">
            The 979 reports you can search are written by a generator in the style of real surgical pathology reports. They describe
            no real patient. Each one names the specimen, then a final diagnosis with the findings that trial criteria depend on:
            histology, size, margins, lymph nodes and stage.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr]">
            <pre className="stagger overflow-x-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 font-mono text-[11.5px] leading-relaxed">
              <span className="text-slate-500">SURGICAL PATHOLOGY REPORT (SYNTHETIC; NOT A REAL PATIENT){'\n'}Patient: M, age band 60-69 | Report year: 2021{'\n\n'}</span>
              <mark className="rounded bg-[#fcd9e3] px-0.5">SPECIMEN:</mark> Lower lobe of lung, left, lobectomy{'\n\n'}
              <mark className="rounded bg-[#fcd9e3] px-0.5">FINAL DIAGNOSIS:</mark> invasive non-mucinous adenocarcinoma; Tumor size: 2.6 cm; Margins: negative; Lymph nodes: 0 of 15 positive; Pathologic stage: pT1c pN0…
            </pre>
            <ul className="stagger grid grid-cols-2 gap-2 md:grid-cols-1">
              <Stat n="979">test reports in the app, with no answer key</Stat>
              <Stat n="9,010">training reports, used only to check the rules</Stat>
              <Stat n="30">trial criteria each report is checked against</Stat>
            </ul>
          </div>
        </Section>
      )}

      {tab === 'slides' && (
        <Section id="slides" title="Scanned whole-slide images">
          <p className="mt-2 text-sm text-slate-700">
            The 263 slides are real tissue scans from four suppliers, mostly H&E-stained. Most carry an organ label; 67 are held out
            with no label, and for those the organ is the model’s prediction. The app shows a thumbnail of each slide and a sample of
            up to 35 tiles cut from it.
          </p>
          <div className="mt-3 rounded border border-slate-200 bg-white p-3">
            <div className="stagger flex flex-wrap items-start gap-3">
              <Img src={thumbUrl(EXAMPLE)} label="A whole slide" className="h-28 w-28" />
              <span aria-hidden className="mt-12 text-slate-400">→</span>
              {TILES.map((t, i) => (
                <Img key={i} src={tileUrl(EXAMPLE, t)} label={`Tile ${i + 1} (20x)`} className="h-28 w-28" />
              ))}
            </div>
            <div className="stagger mt-3 flex flex-wrap items-start gap-3 border-t border-slate-100 pt-3">
              {OTHERS.map((id, i) => (
                <Img key={id} src={thumbUrl(id)} label={['Same supplier', 'Another organ', 'Another supplier'][i]} className="h-16 w-16" />
              ))}
              <p className="max-w-xs self-center text-xs text-slate-500">
                Suppliers scan differently, so colour and layout vary a lot between slides of the same organ.
              </p>
            </div>
          </div>
          <ul className="stagger mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat n="263">slides in total</Stat>
            <Stat n="67">held out, organ predicted</Stat>
            <Stat n="15">organ groups</Stat>
            <Stat n="4">suppliers</Stat>
          </ul>
        </Section>
      )}

      {tab === 'limits' && (
        <Section id="limits" title="What to keep in mind">
          <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white p-2">
            <SeparateDiagram />
          </div>
          <ul className="stagger mt-4 space-y-3 text-sm text-slate-700">
            <li>
              <strong>Reports and slides are separate.</strong> Nothing here links a report to a patient’s slides, so a matched slide is
              related by organ only.
            </li>
            <li>
              <strong>Accuracy figures are from labelled data.</strong> Rules score a mean F1 of 1.000 on the 9,010 training reports,
              and organ prediction is 87.4% accurate by leave-one-out. The test reports have no answer key.
            </li>
            <li>
              <strong>Similar slides depend on the predicted organ,</strong> so a wrong prediction pulls in the wrong slides. Only ranks
              are available, not similarity scores.
            </li>
            <li>
              <strong>Slide upload is a demo.</strong> The organ model needs precomputed GigaPath embeddings, so an uploaded slide is not
              analysed; the page shows the stored result for a random held-out slide.
            </li>
            <li>
              <strong>Tiles are a sample,</strong> up to 35 per slide at about 0.5 µm/px, not the whole slide. Marker positions on the
              overview are approximate.
            </li>
          </ul>
        </Section>
      )}

      <footer className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Research prototype built on the Biobase hackathon data. Not for clinical use.
      </footer>
    </dialog>
  )
}
