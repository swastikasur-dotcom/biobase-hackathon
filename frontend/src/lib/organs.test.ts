import { describe, expect, it } from 'vitest'
import type { Report } from '../types'
import { criterionOrgans } from './organs'

const report = (id: string, organ: string | null): Report => ({ id, text: '', fields: { organ }, matches: [] })

describe('criterionOrgans', () => {
  it('picks the most common organ among matching reports', () => {
    const reports = new Map([report('a', 'breast'), report('b', 'breast'), report('c', 'lung')].map((r) => [r.id, r]))
    expect(criterionOrgans({ c01: ['a', 'b', 'c'] }, reports)).toEqual({ c01: 'breast' })
  })

  it('falls back to "other" when no report has an organ', () => {
    const reports = new Map([report('a', null)].map((r) => [r.id, r]))
    expect(criterionOrgans({ c01: ['a'], c02: [] }, reports)).toEqual({ c01: 'other', c02: 'other' })
  })
})
