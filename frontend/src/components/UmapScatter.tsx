import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { categoryColor } from '../lib/colors'
import { cardLeft, cardTop } from '../lib/hovercard'
import { shortId, slideOrgan } from '../lib/slides'
import type { Slide, UmapPoint } from '../types'
import SlideHoverCard from './SlideHoverCard'

const SIZE = 600
const PAD = 18
const GREY = '#cbd5e1'

/** Highlight mode: the query slide and its similar slides stand out, every other slide is greyed. */
export interface Focus {
  queryId: string
  /** Best first; rank = position + 1. */
  similarIds: string[]
}

type Role = 'query' | 'similar' | 'other'

interface Hover {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * 2D map of slide embeddings. Colour = organ group (known, or predicted for held-out slides, shown hollow).
 * Hover or focus a dot for a preview card; click or press Enter to open the slide.
 */
export default function UmapScatter({
  points,
  slides,
  organGroups,
  focus,
  activeId,
  onActiveChange,
  maxWidth = 640,
}: {
  points: UmapPoint[]
  slides: Map<string, Slide>
  organGroups: string[]
  focus?: Focus
  /** A slide emphasised from outside the map (e.g. hovered in a grid next to it). */
  activeId?: string
  onActiveChange?: (id: string | null) => void
  maxWidth?: number
}) {
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  const colors = useMemo(() => new Map(organGroups.map((g, i) => [g, categoryColor(i, organGroups.length)])), [organGroups])
  const rank = useMemo(() => new Map((focus?.similarIds ?? []).map((id, i) => [id, i + 1])), [focus])
  const pos = useMemo(() => new Map(points.map((p) => [p.id, p])), [points])
  const px = (v: number) => PAD + v * (SIZE - 2 * PAD)

  const roleOf = (id: string): Role => (!focus ? 'other' : id === focus.queryId ? 'query' : rank.has(id) ? 'similar' : 'other')

  // Draw greyed dots first, then similar ones, the query last, so highlights are never hidden.
  const ordered = useMemo(() => {
    const weight = { other: 0, similar: 1, query: 2 }
    return [...points].sort((a, b) => weight[roleOf(a.id)] - weight[roleOf(b.id)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, focus])

  function show(id: string, p: UmapPoint) {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect() // the svg fills the box exactly (square), so map units scale linearly
    setHover({ id, x: (px(p.x) / SIZE) * r.width, y: (px(p.y) / SIZE) * r.height, width: r.width, height: r.height })
    onActiveChange?.(id)
  }
  function hide() {
    setHover(null)
    onActiveChange?.(null)
  }

  const hovered = hover ? slides.get(hover.id) : undefined
  const badgeFor = (id: string) => (focus ? (id === focus.queryId ? 'This slide' : rank.has(id) ? `Similar #${rank.get(id)}` : undefined) : undefined)

  return (
    <div ref={box} className="relative mx-auto w-full" style={{ maxWidth }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block aspect-square w-full rounded border border-slate-200 bg-white" role="group" aria-label="Map of slides; each dot is a slide">
        {focus && pos.has(focus.queryId) &&
          focus.similarIds.map((id) => {
            const a = pos.get(focus.queryId)!
            const b = pos.get(id)
            return b && <line key={id} x1={px(a.x)} y1={px(a.y)} x2={px(b.x)} y2={px(b.y)} stroke="#94a3b8" strokeOpacity={0.45} strokeDasharray="3 3" />
          })}

        {ordered.map((p) => {
          const slide = slides.get(p.id)
          const { organ, predicted } = slide ? slideOrgan(slide) : { organ: undefined, predicted: false }
          const color = (organ && colors.get(organ)) || '#94a3b8'
          const role = roleOf(p.id)
          const dimmed = focus && role === 'other'
          const emphasised = p.id === activeId || p.id === hover?.id
          const r = role === 'query' ? 10 : role === 'similar' ? 8.5 : dimmed ? 4 : 5.5
          const radius = emphasised ? r + 2.5 : r
          const hollow = predicted && !focus
          return (
            <g
              key={p.id}
              role="link"
              tabIndex={0}
              aria-label={`${shortId(p.id)}, ${organ ?? 'unknown organ'}${predicted ? ' (predicted)' : ''}${rank.has(p.id) ? `, similar slide ${rank.get(p.id)}` : ''}`}
              className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-blue-700"
              onMouseEnter={() => show(p.id, p)}
              onMouseLeave={hide}
              onFocus={() => show(p.id, p)}
              onBlur={hide}
              onClick={() => navigate(`/slides/${p.id}`)}
              onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && navigate(`/slides/${p.id}`)}
            >
              <circle cx={px(p.x)} cy={px(p.y)} r={Math.max(radius, 9)} fill="transparent" />
              <circle
                cx={px(p.x)}
                cy={px(p.y)}
                r={radius}
                fill={dimmed ? GREY : hollow ? 'white' : color}
                fillOpacity={dimmed ? 0.7 : 1}
                stroke={role === 'query' ? '#0f172a' : emphasised ? '#1d4ed8' : dimmed ? GREY : color}
                strokeWidth={role === 'query' ? 3 : emphasised ? 3 : hollow ? 2 : 1}
                style={{ transition: 'r 0.15s ease, fill 0.2s ease' }}
              />
              {role === 'similar' && (
                <text x={px(p.x)} y={px(p.y)} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill="white" pointerEvents="none">
                  {rank.get(p.id)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hover && hovered && (
        <div
          key={hover.id}
          className="pointer-events-none absolute z-10"
          style={{ left: cardLeft(hover.x, hover.width), top: cardTop(hover.y, hover.height) }}
        >
          <SlideHoverCard slide={hovered} badge={badgeFor(hover.id)} />
        </div>
      )}
    </div>
  )
}

export function UmapLegend({ organGroups, only, focus }: { organGroups: string[]; only?: Set<string>; focus?: boolean }) {
  const shown = organGroups.map((g, i) => ({ g, color: categoryColor(i, organGroups.length) })).filter(({ g }) => !only || only.has(g))
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {focus && (
        <>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full border-[3px] border-slate-900 bg-slate-400" />
            this slide
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full bg-slate-400" />
            ten most similar (numbered)
          </li>
          <li className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GREY }} />
            all other slides
          </li>
        </>
      )}
      {shown.map(({ g, color }) => (
        <li key={g} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
          {g}
        </li>
      ))}
      {!focus && (
        <li className="flex items-center gap-1.5 text-slate-500">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-500 bg-white" />
          hollow = predicted
        </li>
      )}
    </ul>
  )
}
