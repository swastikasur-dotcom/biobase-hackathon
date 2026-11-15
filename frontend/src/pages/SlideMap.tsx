import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConfidenceBadge from '../components/ConfidenceBadge'
import Status from '../components/Status'
import UmapScatter from '../components/UmapScatter'
import { useSlideIndex, useUmap } from '../data/api'
import { categoryColor } from '../lib/colors'
import { filtersFromParams, hasFilters, matchesFilters, noFilters, organCounts, paramsFromFilters, SCOPES, type MapFilters } from '../lib/mapFilter'
import { shortId, slideOrgan, thumbUrl } from '../lib/slides'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { Slide } from '../types'

const input = 'w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm'
const heading = 'mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500'
const SHOWN = 12
/** The map is wider than tall so it fills the column beside the filters. */
const MAP_ASPECT = 1.6

function uniqueSorted(values: (string | undefined)[]) {
  return [...new Set(values.filter((v): v is string => !!v))].sort()
}

export default function SlideMap() {
  useDocumentTitle('Slide map')
  const slides = useSlideIndex()
  const umap = useUmap()
  const [params, setParams] = useSearchParams()
  const [active, setActive] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  // Held in state so the controls respond at once, and mirrored to the URL so a filtered view can be shared or reloaded.
  const [filters, setFilters] = useState<MapFilters>(() => filtersFromParams(params))
  const apply = (next: MapFilters) => {
    setFilters(next)
    setParams(paramsFromFilters(next), { replace: true })
  }
  const update = (patch: Partial<MapFilters>) => apply({ ...filters, ...patch })

  // Only slides that have a point on the map take part in counts and the list.
  const mapped = useMemo(
    () => (umap.data?.points ?? []).map((p) => slides.index.get(p.id)).filter((s): s is Slide => !!s),
    [umap.data, slides.index],
  )
  const visibleIds = useMemo(() => new Set(mapped.filter((s) => matchesFilters(s, filters)).map((s) => s.id)), [mapped, filters])
  const inView = useMemo(
    () =>
      mapped
        .filter((s) => visibleIds.has(s.id))
        // least certain first: low-confidence predictions are what a reviewer wants to see
        .sort((a, b) => (a.prediction?.confidence ?? 2) - (b.prediction?.confidence ?? 2) || a.id.localeCompare(b.id)),
    [mapped, visibleIds],
  )
  const counts = useMemo(() => organCounts(mapped, filters), [mapped, filters])
  const suppliers = useMemo(() => uniqueSorted(mapped.map((s) => s.supplierId)), [mapped])
  const stains = useMemo(() => uniqueSorted(mapped.map((s) => s.stain)), [mapped])
  const organGroups = slides.data?.organGroups ?? []
  const filtered = hasFilters(filters)

  function toggleOrgan(g: string) {
    const next = new Set(filters.organs)
    if (next.has(g)) next.delete(g)
    else next.add(g)
    update({ organs: next })
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Slide map</h1>

      <Status queries={[slides, umap]}>
        {slides.data && umap.data && (
          <div className="stagger mt-5 grid items-start gap-6 lg:grid-cols-[17rem_1fr]">
            {/* ---------- Filters ---------- */}
            <aside aria-label="Map filters" className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
              <div>
                <label htmlFor="map-q" className={`${heading} block`}>
                  Find a slide
                </label>
                <input
                  id="map-q"
                  type="search"
                  value={filters.q}
                  onChange={(e) => update({ q: e.target.value })}
                  placeholder="Slide id or diagnosis"
                  className={input}
                />
              </div>

              <div>
                <h2 className={heading}>Show</h2>
                <div role="group" aria-label="Which slides" className="grid grid-cols-2 gap-1">
                  {SCOPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      title={s.hint}
                      aria-pressed={filters.scope === s.value}
                      onClick={() => update({ scope: s.value })}
                      className={`rounded border px-2 py-1.5 text-sm font-medium ${
                        filters.scope === s.value ? 'border-slate-900 bg-blue-700 text-white' : 'border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <h2 className={heading}>Organ</h2>
                  {filters.organs.size > 0 && (
                    <button type="button" onClick={() => update({ organs: new Set() })} className="text-xs text-blue-700 hover:underline">
                      Clear
                    </button>
                  )}
                </div>
                <ul className="stagger grid grid-cols-2 gap-x-2 gap-y-0.5 lg:grid-cols-1">
                  {organGroups.map((g, i) => {
                    const n = counts.get(g) ?? 0
                    const on = filters.organs.has(g)
                    return (
                      <li key={g}>
                        <label className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50 ${n === 0 && !on ? 'text-slate-400' : ''}`}>
                          <input type="checkbox" checked={on} onChange={() => toggleOrgan(g)} />
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryColor(i, organGroups.length) }} />
                          <span className="min-w-0 flex-1 truncate">{g}</span>
                          <span className="tabular-nums text-xs text-slate-500">{n}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="map-supplier" className={`${heading} block`}>
                    Supplier
                  </label>
                  <select id="map-supplier" value={filters.supplier} onChange={(e) => update({ supplier: e.target.value })} className={input}>
                    <option value="">Any</option>
                    {suppliers.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="map-stain" className={`${heading} block`}>
                    Stain
                  </label>
                  <select id="map-stain" value={filters.stain} onChange={(e) => update({ stain: e.target.value })} className={input}>
                    <option value="">Any</option>
                    {stains.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filtered && (
                <button
                  type="button"
                  onClick={() => apply(noFilters)}
                  className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                >
                  Reset filters
                </button>
              )}
            </aside>

            {/* ---------- Map and slides in view ---------- */}
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                <p aria-live="polite" className="font-medium">
                  <span key={`${filtered}-${inView.length}`} className="fade-in inline-block">
                    {filtered ? `Showing ${inView.length} of ${mapped.length} slides` : `${mapped.length} slides`}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-500 bg-white" />
                    hollow = predicted
                  </span>
                  {filtered && (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
                      faded = filtered out
                    </span>
                  )}
                  <span>hover for a preview, click to open</span>
                </p>
              </div>

              <UmapScatter
                points={umap.data.points}
                slides={slides.index}
                organGroups={organGroups}
                visibleIds={filtered ? visibleIds : undefined}
                activeId={active ?? undefined}
                onActiveChange={setActive}
                aspect={MAP_ASPECT}
                maxWidth={`min(100%, ${Math.round(MAP_ASPECT * 76)}vh)`} // as wide as the column, but never taller than the screen
              />

              <section aria-labelledby="inview-h" className="mt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="inview-h" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Slides in view
                  </h2>
                  {inView.length > SHOWN && (
                    <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-blue-700 hover:underline">
                      {showAll ? `Show first ${SHOWN}` : `Show all ${inView.length}`}
                    </button>
                  )}
                </div>
                {inView.length === 0 ? (
                  <p className="mt-3 rounded border border-slate-200 bg-white p-4 text-slate-600">
                    No slides match these filters.{' '}
                    <button type="button" onClick={() => apply(noFilters)} className="text-blue-700 hover:underline">
                      Reset filters
                    </button>
                  </p>
                ) : (
                  <ul key={`${inView.length}-${inView[0]?.id}-${showAll}`} className="stagger mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {(showAll ? inView : inView.slice(0, SHOWN)).map((s) => {
                      const { organ, predicted } = slideOrgan(s)
                      return (
                        <li key={s.id}>
                          <Link
                            to={`/slides/${s.id}`}
                            onMouseEnter={() => setActive(s.id)}
                            onMouseLeave={() => setActive(null)}
                            onFocus={() => setActive(s.id)}
                            onBlur={() => setActive(null)}
                            className="lift block overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-slate-400"
                          >
                            <img src={thumbUrl(s.id)} alt={`Thumbnail of slide ${shortId(s.id)}`} loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-contain" />
                            <div className="space-y-1 p-2 text-xs">
                              <div className="truncate font-mono text-slate-500">{shortId(s.id)}</div>
                              <div className="flex flex-wrap items-center gap-1 text-sm font-medium">
                                <span className="truncate">{organ ?? 'Unknown'}</span>
                                {s.prediction && <ConfidenceBadge confidence={s.prediction.confidence} />}
                              </div>
                              {predicted ? <div className="text-slate-500">predicted</div> : s.diagnosis && <div className="truncate text-slate-500">{s.diagnosis}</div>}
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </Status>
    </div>
  )
}
