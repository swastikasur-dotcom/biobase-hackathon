import { describe, expect, it } from 'vitest'
import type { Micrograph, PaperclipFile } from '../types'
import { citation, forOrgan, micrographChips } from './paperclip'

const mg = (over: Partial<Micrograph>): Micrograph => ({
  id: 'x', image: 'images/x.jpg', diagnosis: '', site: '', grade: '', stage: '', stain: 'H&E', magnification: null, specimen: '',
  features: '', caption: '', study: '', title: '', year: null, journal: '', link: '', pmcid: '', qc: '', qcNote: '', ...over,
})

describe('paperclip helpers', () => {
  it('returns an empty record for an organ with no results', () => {
    const file: PaperclipFile = { dataset: 'd', organs: { Liver: { micrographs: [mg({})], biomarkers: [], profile: null } } }
    expect(forOrgan(file, 'Liver').micrographs).toHaveLength(1)
    expect(forOrgan(file, 'Esophagus')).toEqual({ micrographs: [], biomarkers: [], profile: null })
  })

  it('builds chips without doubling the word "Grade"', () => {
    expect(micrographChips(mg({ magnification: 400, grade: 'Grade 2', stage: 'IIB', specimen: 'resection' }))).toEqual([
      '400x', 'Grade 2', 'Stage IIB', 'resection',
    ])
    expect(micrographChips(mg({ grade: '2' }))).toEqual(['Grade 2'])
    expect(micrographChips(mg({ grade: 'Gleason score 3+3' }))).toEqual(['Gleason score 3+3'])
    expect(micrographChips(mg({ grade: 'ISUP grade group 5' }))).toEqual(['ISUP grade group 5'])
    expect(micrographChips(mg({}))).toEqual([])
  })

  it('formats citations without repeating the year', () => {
    expect(citation({ study: 'Chow & Laklouk 2025', year: 2025, journal: 'Cureus' })).toBe('Chow & Laklouk 2025 · Cureus')
    expect(citation({ study: 'Sharif et al.', year: 2025, journal: 'Frontiers' })).toBe('Sharif et al. 2025 · Frontiers')
    expect(citation({ study: 'Anon', year: null, journal: '' })).toBe('Anon')
  })
})
