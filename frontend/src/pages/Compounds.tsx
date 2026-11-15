import { useDocumentTitle } from '../lib/useDocumentTitle'

/** The KIT / GIST evidence workbench from the kittriage project, shown as built (build/report.html). */
export default function Compounds() {
  useDocumentTitle('Find compounds')
  const src = `${import.meta.env.BASE_URL}kit-report.html`
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Find compounds</h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Failure-informed compound triage for KIT in GIST: what stopped earlier drugs, and how 10,000 candidates score against it. This is a
            separate project from the Biobase reports and slides.
          </p>
        </div>
        <a href={src} target="_blank" rel="noopener noreferrer" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-blue-50">
          Open in a new tab ↗
        </a>
      </div>
      <iframe
        title="KIT / GIST evidence workbench"
        src={src}
        className="mt-5 block h-[78dvh] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
      />
    </div>
  )
}
