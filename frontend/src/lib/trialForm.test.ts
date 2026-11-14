import { describe, expect, it } from 'vitest'
import type { TrialProfile } from '../types'
import { emptyForm, formFromProfile, profileFromForm } from './trialForm'

const profile: TrialProfile = {
  primary_organ: 'breast', sex: 'female', histology: 'Invasive ductal carcinoma', stage: 'pT2 pN1a', tumor_size_mm: 45,
  age_years: null, metastatic_status: null, treatment_naive: null,
  biomarkers: { ER: 'negative', PR: 'negative', HER2: 'negative' }, pathology_facts: { age_band: '60-69' }, location: {},
}

describe('trial profile form', () => {
  it('round-trips a profile through the form', () => {
    const f = formFromProfile(profile)
    expect(f).toMatchObject({ organ: 'breast', sex: 'female', age: '', tumorSize: '45', er: 'negative', treatmentNaive: '' })
    const back = profileFromForm(f, profile)
    expect(back.ok && back.profile).toMatchObject({ primary_organ: 'breast', age_years: null, tumor_size_mm: 45, treatment_naive: null })
    expect(back.ok && back.profile.pathology_facts).toEqual({ age_band: '60-69' })
  })

  it('requires an organ and a sensible age and tumour size', () => {
    expect(profileFromForm(emptyForm)).toEqual({ ok: false, error: 'Primary organ is required.' })
    expect(profileFromForm({ ...emptyForm, organ: 'breast', age: '4.5' }).ok).toBe(false)
    expect(profileFromForm({ ...emptyForm, organ: 'breast', age: '200' }).ok).toBe(false)
    expect(profileFromForm({ ...emptyForm, organ: 'breast', tumorSize: '-1' }).ok).toBe(false)
  })

  it('reads yes/no treatment status and only sends a radius with a place', () => {
    const r = profileFromForm({ ...emptyForm, organ: 'lung', age: '62', treatmentNaive: 'no', radius: '50' })
    expect(r.ok && r.profile).toMatchObject({ age_years: 62, treatment_naive: false, location: {} })
    const withPlace = profileFromForm({ ...emptyForm, organ: 'lung', location: ' Palo Alto, CA ', radius: '50' })
    expect(withPlace.ok && withPlace.profile.location).toEqual({ query: 'Palo Alto, CA', radius_miles: 50 })
  })
})
