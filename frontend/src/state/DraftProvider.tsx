import { useMemo, useState, type ReactNode } from 'react'
import { DraftContext } from './draft'

export default function DraftProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('')
  const value = useMemo(() => ({ text, setText }), [text])
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}
