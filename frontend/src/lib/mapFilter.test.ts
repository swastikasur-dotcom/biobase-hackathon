import { describe, expect, it } from 'vitest'
import type { Slide } from '../types'
import { filtersFromParams, matchesFilters, noFilters, organCounts, paramsFromFilters } from './mapFilter'

const slide = (id: string, o: Partial<Slide>): Slide => ({ id, heldout: false, ...o })
const slides = [
  slide('SUPP-02-bb_02_wsi_0001', { organGroup: 'Kidney', supplierId: 'SUPP-02', stain: 'H&E' }),
  slide('SUPP-01-biobase_aaaaaaaa-0000-0000-0000-000000000000', { organGroup: 'Lung', supplierId: 'SUPP-01', stain: 'IHC' }),
  slide('SUPP-02-bb_02_wsi_0003', { heldout: true, supplierId: 'SUPP-02', stain: 'H&E', prediction: { organ: 'Kidney', confidence: 0.9 } }),
  slide('SUPP-02-bb_02_wsi_0004', { heldout: true, supplierId: 'SUPP-02', stain: 'H&E', prediction: { organ: 'Lung', confidence: 0.3 }, diagnosis: 'squamous' }),
]
const pick = (f: Partial<typeof noFilters>) => slides.filter((s) => matchesFilters(s, { ...noFilters, ...f })).map((s) => s.id.slice(-4))

describe('map filters', () => {
  it('passes everything with no filters', () => expect(pick({})).toHaveLength(4))

  it('filters by scope, treating predictions below 50% as needing review', () => {
    expect(pick({ scope: 'labelled' })).toEqual(['0001', '0000'])
    expect(pick({ scope: 'heldout' })).toEqual(['0003', '0004'])
    expect(pick({ scope: 'review' })).toEqual(['0004'])
  })

  it('filters by organ, using the prediction for held-out slides', () => {
    expect(pick({ organs: new Set(['Kidney']) })).toEqual(['0001', '0003'])
    expect(pick({ organs: new Set(['Kidney', 'Lung']) })).toHaveLength(4)
  })

  it('combines supplier, stain and text', () => {
    expect(pick({ supplier: 'SUPP-01' })).toEqual(['0000'])
    expect(pick({ stain: 'IHC' })).toEqual(['0000'])
    expect(pick({ q: 'squamous' })).toEqual(['0004'])
    expect(pick({ q: 'supp-02 · 0003' })).toEqual(['0003'])
    expect(pick({ supplier: 'SUPP-02', organs: new Set(['Lung']) })).toEqual(['0004'])
  })

  it('counts organs among slides passing the other filters', () => {
    expect([...organCounts(slides, noFilters)]).toEqual([['Kidney', 2], ['Lung', 2]])
    expect([...organCounts(slides, { ...noFilters, scope: 'heldout' })]).toEqual([['Kidney', 1], ['Lung', 1]])
    // the organ selection itself does not change the counts
    expect(organCounts(slides, { ...noFilters, organs: new Set(['Kidney']) }).get('Lung')).toBe(2)
  })

  it('round-trips through the URL and ignores junk', () => {
    const f = { scope: 'review' as const, organs: new Set(['Kidney', 'Colon and rectum']), supplier: 'SUPP-02', stain: 'H&E', q: ' 0004 ' }
    const back = filtersFromParams(paramsFromFilters(f))
    expect(back).toEqual({ ...f, q: '0004' })
    expect(filtersFromParams(new URLSearchParams('scope=bogus')).scope).toBe('all')
    expect(paramsFromFilters(noFilters).toString()).toBe('')
  })
})
