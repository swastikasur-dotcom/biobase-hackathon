import { useMemo, useState, type ReactNode } from 'react'
import { DraftContext } from './draft'

export default function DraftProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('')
  const [seeded, setSeeded] = useState(false)
  const value = useMemo(() => ({ text, setText, seeded, setSeeded }), [text, seeded])
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}
