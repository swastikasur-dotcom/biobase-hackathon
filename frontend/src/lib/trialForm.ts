import type { TrialProfile } from '../types'

/** The editable profile as strings, the way form inputs hold it. */
export interface ProfileForm {
  organ: string
  histology: string
  sex: '' | 'female' | 'male'
  age: string
  stage: string
  metastatic: '' | 'metastatic' | 'non_metastatic'
  tumorSize: string
  treatmentNaive: '' | 'yes' | 'no'
  er: string
  pr: string
  her2: string
  location: string
  radius: string
}

export const emptyForm: ProfileForm = {
  organ: '', histology: '', sex: '', age: '', stage: '', metastatic: '', tumorSize: '', treatmentNaive: '',
  er: '', pr: '', her2: '', location: '', radius: '',
}

export function formFromProfile(p: TrialProfile): ProfileForm {
  return {
    organ: p.primary_organ ?? '',
    histology: p.histology ?? '',
    sex: p.sex === 'female' || p.sex === 'male' ? p.sex : '',
    age: p.age_years == null ? '' : String(p.age_years),
    stage: p.stage ?? '',
    metastatic: p.metastatic_status === 'metastatic' || p.metastatic_status === 'non_metastatic' ? p.metastatic_status : '',
    tumorSize: p.tumor_size_mm == null ? '' : String(p.tumor_size_mm),
    treatmentNaive: p.treatment_naive == null ? '' : p.treatment_naive ? 'yes' : 'no',
    er: p.biomarkers?.ER ?? '',
    pr: p.biomarkers?.PR ?? '',
    her2: p.biomarkers?.HER2 ?? '',
    location: p.location?.query ?? '',
    radius: p.location?.radius_miles == null ? '' : String(p.location.radius_miles),
  }
}

export type ProfileResult = { ok: true; profile: TrialProfile } | { ok: false; error: string }

/** Turn the form back into a profile, keeping the report-derived facts in `base` that the form does not edit. */
export function profileFromForm(f: ProfileForm, base?: TrialProfile | null): ProfileResult {
  const organ = f.organ.trim()
  if (!organ) return { ok: false, error: 'Primary organ is required.' }
  let age: number | null = null
  if (f.age.trim() !== '') {
    age = Number(f.age)
    if (!Number.isInteger(age) || age < 0 || age > 130) return { ok: false, error: 'Age must be a whole number from 0 to 130.' }
  }
  let size: number | null = null
  if (f.tumorSize.trim() !== '') {
    size = Number(f.tumorSize)
    if (!Number.isFinite(size) || size < 0) return { ok: false, error: 'Tumour size must be a number of millimetres, 0 or more.' }
  }
  const biomarkers: Record<string, string> = {}
  for (const [k, v] of [['ER', f.er], ['PR', f.pr], ['HER2', f.her2]] as const) if (v) biomarkers[k] = v
  const location: TrialProfile['location'] = {}
  if (f.location.trim()) {
    location.query = f.location.trim()
    if (f.radius) location.radius_miles = Number(f.radius)
  }
  return {
    ok: true,
    profile: {
      primary_organ: organ,
      patient_reference: base?.patient_reference ?? 'local',
      age_years: age,
      sex: f.sex || null,
      histology: f.histology.trim() || null,
      stage: f.stage.trim() || null,
      metastatic_status: f.metastatic || null,
      tumor_size_mm: size,
      treatment_naive: f.treatmentNaive === '' ? null : f.treatmentNaive === 'yes',
      biomarkers,
      pathology_facts: base?.pathology_facts ?? {},
      location,
    },
  }
}
