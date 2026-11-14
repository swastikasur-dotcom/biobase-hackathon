import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

export interface Draft {
  /** Report text being edited on the upload page. Kept here so it survives a trip to the result page. */
  text: string
  setText: Dispatch<SetStateAction<string>>
  /** True once the example report has been offered (or the user cleared it), so it is not put back. */
  seeded: boolean
  setSeeded: (seeded: boolean) => void
}

export const DraftContext = createContext<Draft | null>(null)

export function useDraft(): Draft {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used inside <DraftProvider>')
  return ctx
}
