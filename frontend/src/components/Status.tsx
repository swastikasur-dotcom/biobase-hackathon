import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/** Renders loading and error states for a query, and its children once data is ready. */
export default function Status({
  queries,
  children,
}: {
  queries: Pick<UseQueryResult<unknown>, 'isError' | 'isPending' | 'error'>[]
  children: ReactNode
}) {
  const failed = queries.find((q) => q.isError)
  if (failed) {
    return (
      <p role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
        {(failed.error as Error).message}
      </p>
    )
  }
  if (queries.some((q) => q.isPending)) return <p className="text-slate-500">Loading…</p>
  return <div className="fade-in">{children}</div>
}
