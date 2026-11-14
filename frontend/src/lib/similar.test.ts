import { describe, expect, it } from 'vitest'
import type { Report } from '../types'
import { similarReports } from './similar'

const r = (id: string, matches: string[]): Report => ({ id, text: '', fields: {}, matches })

describe('similarReports', () => {
  const reports = [r('b', ['c01']), r('a', ['c01', 'c02']), r('c', ['c09']), r('d', ['c01', 'c02'])]

  it('ranks by shared criteria, then id, and drops reports sharing none', () => {
    expect(similarReports(['c01', 'c02'], reports).map((x) => x.report.id)).toEqual(['a', 'd', 'b'])
  })

  it('reports which criteria are shared', () => {
    expect(similarReports(['c01', 'c02'], reports)[0].shared).toEqual(['c01', 'c02'])
  })

  it('respects the limit and returns nothing without matches', () => {
    expect(similarReports(['c01', 'c02'], reports, 1)).toHaveLength(1)
    expect(similarReports([], reports)).toEqual([])
  })
})
