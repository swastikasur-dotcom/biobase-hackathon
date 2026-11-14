import { useState } from 'react'
import PaperclipIcon from './PaperclipIcon'
import PaperclipPanel from './PaperclipPanel'

/** Opens a side panel with the Paperclip literature results for an organ. Disabled until an organ is known. */
export default function PaperclipButton({ organ, className = '' }: { organ?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!organ}
        title={organ ? `Paperclip literature results for ${organ}` : 'Choose an organ to see Paperclip results'}
        className={`inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 ${className}`}
      >
        <PaperclipIcon />
        Paperclip
      </button>
      {open && organ && <PaperclipPanel organ={organ} onClose={() => setOpen(false)} />}
    </>
  )
}
