import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSlidesFile } from '../data/api'
import { formatBytes, pickHeldoutSlide } from '../lib/slides'
import type { SlideUploadState } from '../types'

const ACCEPT = 'image/*,.svs,.tif,.tiff,.ndpi,.mrxs'

/** Upload card shown at the top of the slide browser. Demo only: the file is never read or sent. */
export default function SlideUploadCard() {
  const navigate = useNavigate()
  const slides = useSlidesFile()
  const [picked, setPicked] = useState<{ file: File; preview: string | null } | null>(null)
  const [dragging, setDragging] = useState(false)
  const previewUrl = useRef<string | null>(null)

  // Release the preview's object URL when leaving the page.
  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
  }, [])

  // Small images are previewed in the browser only; the file is never uploaded.
  function choose(file: File | null | undefined) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = file && file.type.startsWith('image/') && file.size <= 25 * 1024 ** 2 ? URL.createObjectURL(file) : null
    setPicked(file ? { file, preview: previewUrl.current } : null)
  }

  function analyse(file?: File) {
    const slide = pickHeldoutSlide(slides.data?.slides ?? [])
    if (!slide) return
    const state: SlideUploadState = { slideId: slide.id, ...(file && { file: { name: file.name, size: file.size } }) }
    navigate('/slides/analysis', { state })
  }

  return (
    <section aria-labelledby="upload-h" className="w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:max-w-md">
      <h2 id="upload-h" className="text-sm font-semibold">
        Analyse a slide
      </h2>

      <form
        className="mt-2 space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (picked) analyse(picked.file)
        }}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            choose(e.dataTransfer.files[0])
          }}
          className={`flex min-w-0 items-center gap-2 rounded border-2 border-dashed px-2 py-1.5 ${
            dragging ? 'border-blue-600 bg-blue-50' : 'border-slate-300'
          }`}
        >
          {picked?.preview && <img src={picked.preview} alt="Preview of the selected file" className="h-8 w-8 rounded border border-slate-200 object-cover" />}
          <span className="min-w-0 flex-1 truncate text-xs">
            {picked ? (
              <>
                <span className="font-mono">{picked.file.name}</span> <span className="text-slate-500">· {formatBytes(picked.file.size)}</span>
              </>
            ) : (
              <span className="text-slate-500">Drop a slide here</span>
            )}
          </span>
          <label className="shrink-0 cursor-pointer rounded bg-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-300 focus-within:outline-2 focus-within:outline-blue-700">
            {picked ? 'Change' : 'Choose a file'}
            <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!picked || !slides.data}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Analyse slide
          </button>
          <button
            type="button"
            onClick={() => analyse()}
            disabled={!slides.data}
            className="text-sm text-blue-700 underline hover:text-blue-900 disabled:opacity-40"
          >
            Select test case
          </button>
        </div>
      </form>
    </section>
  )
}
