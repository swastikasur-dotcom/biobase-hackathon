import { useState } from 'react'
import { useTiles } from '../data/api'
import { thumbUrl } from '../lib/slides'
import { tilePosition, tileUrl } from '../lib/tiles'
import type { Slide } from '../types'

const ZOOMS = [1, 2, 3]

/**
 * The 20x tiles are a sparse sample (up to 35 per slide), not a continuous image, so this is a
 * tile gallery with zoom, plus approximate markers showing where each tile sits on the thumbnail.
 */
export default function TileViewer({ slide }: { slide: Slide }) {
  const tiles = useTiles()
  const [picked, setPicked] = useState<{ slideId: string; index: number }>({ slideId: slide.id, index: 0 })
  const [zoom, setZoom] = useState(1)

  const list = tiles.data?.[slide.id] ?? []
  // Reset to the first tile when navigating to another slide.
  const index = picked.slideId === slide.id ? Math.min(picked.index, Math.max(list.length - 1, 0)) : 0
  const select = (i: number) => setPicked({ slideId: slide.id, index: i })

  if (tiles.isPending) return <p className="text-slate-500">Loading tiles…</p>
  if (tiles.isError) return <p role="alert" className="text-red-800">{(tiles.error as Error).message}</p>
  if (list.length === 0) {
    return <p className="text-slate-500">No usable 20x tiles for this slide (all sampled tiles were blank).</p>
  }

  const current = list[index]
  const pos = tilePosition(slide, current)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="relative inline-block max-w-full rounded border border-slate-200 bg-white">
          <img src={thumbUrl(slide.id)} alt={`Slide ${slide.id} overview`} className="block max-h-80 max-w-full object-contain" />
          {list.map((t, i) => {
            const p = tilePosition(slide, t)
            if (!p) return null
            return (
              <button
                key={`${t[0]}_${t[1]}`}
                type="button"
                onClick={() => select(i)}
                aria-label={`Show tile ${i + 1} of ${list.length}`}
                aria-pressed={i === index}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${
                  i === index ? 'bg-red-600 ring-2 ring-red-300' : 'bg-blue-600/80 hover:bg-blue-800'
                }`}
              />
            )
          })}
        </div>
        <p className="mt-1 text-xs text-slate-500">Marker positions are approximate. {list.length} sampled tiles.</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span>
            Tile {index + 1} of {list.length}
            {pos && <span className="text-slate-500"> · near {Math.round(pos.x * 100)}% across, {Math.round(pos.y * 100)}% down</span>}
          </span>
          <span className="flex gap-1" role="group" aria-label="Zoom">
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                aria-pressed={zoom === z}
                className={`rounded px-2 py-0.5 ${zoom === z ? 'bg-slate-900 text-white' : 'bg-slate-200'}`}
              >
                {z}x
              </button>
            ))}
          </span>
        </div>
        <div className="mt-2 max-h-[28rem] overflow-auto rounded border border-slate-200 bg-slate-100">
          <img
            key={`${current[0]}_${current[1]}`}
            src={tileUrl(slide.id, current)}
            alt={`20x tile ${index + 1} of slide ${slide.id}`}
            style={{ width: 256 * zoom, maxWidth: 'none' }}
            className="fade-in block transition-[width] duration-200"
          />
        </div>
        <ul className="mt-2 flex gap-1 overflow-x-auto pb-1" aria-label="Tiles">
          {list.map((t, i) => (
            <li key={`${t[0]}_${t[1]}`} className="shrink-0">
              <button type="button" onClick={() => select(i)} aria-label={`Tile ${i + 1}`} aria-pressed={i === index}>
                <img
                  src={tileUrl(slide.id, t)}
                  alt=""
                  loading="lazy"
                  className={`h-14 w-14 object-cover ${i === index ? 'ring-2 ring-red-500' : 'opacity-80 hover:opacity-100'}`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
