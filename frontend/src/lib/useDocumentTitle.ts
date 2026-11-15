import { useEffect } from 'react'

/** Sets the tab title (also what screen readers announce on navigation). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Veritome` : 'Veritome'
  }, [title])
}
