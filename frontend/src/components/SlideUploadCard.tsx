import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSlidesFile } from '../data/api'
import { pickHeldoutSlide } from '../lib/slides'
import type { SlideUploadState } from '../types'

const ACCEPT = 'image/*,.svs,.tif,.tiff,.ndpi,.mrxs'

/** One-line control at the top of the slide browser. Demo only: the file is never read or sent. */
export default function SlideUploadCard() {
  const navigate = useNavigate()
  const slides = useSlidesFile()
  const [dragging, setDragging] = useState(false)
  const ready = !!slides.data

  function analyse(file?: File) {
    const slide = pickHeldoutSlide(slides.data?.slides ?? [])
    if (!slide) return
    const state: SlideUploadState = { slideId: slide.id, ...(file && { file: { name: file.name, size: file.size } }) }
    navigate('/slides/analysis', { state })
  }

  return (
    <section aria-label="Analyse a slide" className="flex flex-wrap items-center gap-3">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (ready && e.dataTransfer.files[0]) analyse(e.dataTransfer.files[0])
        }}
        title="Choose a slide file, or drop one here"
        className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700 ${
          dragging ? 'bg-blue-700' : 'bg-blue-700'
        } ${ready ? '' : 'opacity-40'}`}
      >
        Analyse a slide
        <input
          type="file"
          accept={ACCEPT}
          disabled={!ready}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) analyse(file)
          }}
        />
      </label>
      <button
        type="button"
        onClick={() => analyse()}
        disabled={!ready}
        className="text-sm text-blue-700 underline hover:text-blue-900 disabled:opacity-40"
      >
        Select test case
      </button>
    </section>
  )
}
