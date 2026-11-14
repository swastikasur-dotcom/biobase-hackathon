import type { Micrograph, PaperclipFile, PaperclipOrgan } from '../types'

export const paperclipImageUrl = (image: string) => `${import.meta.env.BASE_URL}paperclip/${image}`

const EMPTY: PaperclipOrgan = { micrographs: [], biomarkers: [], profile: null }

/** Results for an organ group; an organ the search found nothing for (e.g. Esophagus) gets an empty record. */
export const forOrgan = (file: PaperclipFile, organ: string): PaperclipOrgan => file.organs[organ] ?? EMPTY

/** Short facts shown on a micrograph card: magnification, grade, stage, specimen. */
export function micrographChips(m: Micrograph): string[] {
  return [
    m.magnification ? `${m.magnification}x` : '',
    m.grade && (/gleason|isup|nottingham|grade|^g\d/i.test(m.grade) ? m.grade : `Grade ${m.grade}`),
    m.stage && `Stage ${m.stage.replace(/^stage\s*/i, '')}`,
    m.specimen,
  ].filter(Boolean) as string[]
}

/** "Chow & Laklouk 2025 · Cureus" */
export const citation = (x: { study: string; year: number | null; journal: string }) =>
  [x.study.includes(String(x.year)) || !x.year ? x.study : `${x.study} ${x.year}`, x.journal].filter(Boolean).join(' · ')
