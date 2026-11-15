export interface Criterion {
  id: string
  text: string
}

/** Criterion id -> report id -> Jev's probability (0-1) that the report meets it. Missing = below 5%. */
export type JevFile = Record<string, Record<string, number>>

/** Criterion id -> ids of the reports that match it. */
export type Cohorts = Record<string, string[]>

export type FieldValue = string | number | null

export interface Report {
  id: string
  text: string
  /** Parsed fields: sex, age_band, report_year, specimen, organ, plus every FINAL DIAGNOSIS field. */
  fields: Record<string, FieldValue>
  /** Criteria this report matches. */
  matches: string[]
}

export interface Prediction {
  /** Predicted organ group (Task C1). */
  organ: string
  /** Model confidence, 0 to 1. Only held-out slides have one. */
  confidence: number
}

export interface SlideReport {
  finalDiagnosis?: string
  specimen?: string
  microscopic?: string
  gross?: string
  clinicalHistory?: string
  siteOperation?: string
  comments?: string
}

export interface Slide {
  id: string
  supplierId?: string
  stain?: string
  magnification?: number
  width?: number
  height?: number
  sex?: string
  ageBucket?: string
  /** Held-out slides have no known organ; they carry a prediction instead. */
  heldout: boolean
  organGroup?: string
  organ?: string
  diagnosis?: string
  stage?: string
  report?: SlideReport
  prediction?: Prediction
}

export interface SlidesFile {
  organGroups: string[]
  slides: Slide[]
}

/** Query slide id -> the 10 most similar slide ids, best first (Task C2). Held-out slides only. */
export type SimilarMap = Record<string, string[]>

/** Slide id -> sampled non-blank 20x tiles as [col, row]. */
export type TilesMap = Record<string, [number, number][]>

export interface UmapPoint {
  id: string
  /** 0 to 1 */
  x: number
  y: number
}

export interface UmapFile {
  model: string
  method: string
  points: UmapPoint[]
}

/** One criterion in an analysis result, with the parsed fields its rule reads. */
export interface CriterionResult {
  id: string
  text: string
  evidence: { field: string; value: string }[]
}

/** Response of POST /api/analyze for one uploaded report. */
export interface AnalysisResult {
  organ: string
  fields: Record<string, FieldValue>
  matches: CriterionResult[]
  /** Criteria for the same organ that the report does not match. */
  not_matched: CriterionResult[]
  summary: string
  warnings: string[]
  /** Jev's probability that the report meets each criterion; null when Jev could not be asked. */
  jev: Record<string, number> | null
  jev_error: string | null
}

/** De-identified patient profile used to search ClinicalTrials.gov (see clinical_trials/models.py). */
export interface TrialProfile {
  primary_organ: string
  patient_reference?: string | null
  age_years?: number | null
  sex?: string | null
  histology?: string | null
  stage?: string | null
  metastatic_status?: string | null
  tumor_size_mm?: number | null
  treatment_naive?: boolean | null
  biomarkers: Record<string, string>
  pathology_facts: Record<string, string>
  location: { query?: string; radius_miles?: number }
}

/** Response of POST /api/trials/profile. */
export interface ProfileFromReport {
  profile: TrialProfile
  parsed_fields: Record<string, FieldValue>
  review_note: string
}

export type TrialAssessment = 'likely_relevant' | 'needs_more_information' | 'not_a_match'
export type Answer = 'yes' | 'no' | 'unknown'
/** NCT id -> question id -> the user's answer. */
export type TrialAnswers = Record<string, Record<string, Answer>>

export interface ClarificationQuestion {
  question_id: string
  prompt: string
  criterion_evidence: string
  yes_effect: string
  no_effect: string
}

export interface TrialSite {
  facility?: string
  city?: string
  state?: string
  country?: string
}

export interface TrialMatch {
  nct_id: string
  status: string
  assessment: TrialAssessment
  matched_facts: string[]
  exclusions: string[]
  unknown_requirements: string[]
  clarification_questions: ClarificationQuestion[]
  nearest_site: TrialSite | null
  distance_miles: number | null
  location_status: string | null
  source_url: string | null
  source_last_updated: string | null
  review_note: string
  trial: {
    nct_id: string
    title: string
    status: string
    conditions: string[]
    interventions: string[]
    official_url: string | null
    eligibility_text: string | null
    last_update_posted: string | null
  }
}

/** One test report that fits a given trial (POST /api/trials/patients). */
export interface TrialPatient {
  report_id: string
  assessment: TrialAssessment
  matched_facts: string[]
  exclusions: string[]
  unknown_requirements: string[]
  questions: string[]
  profile: { organ: string; histology: string | null; sex: string | null; age_band: string | null; stage: string | null }
}

export interface PatientsForTrial {
  trial: TrialMatch['trial']
  summary: Record<TrialAssessment, number>
  results: TrialPatient[]
  /** How many of each category are in `results` (each is capped). */
  shown: Record<TrialAssessment, number>
  review_note: string
}

/** Response of POST /api/trials/search. */
export interface TrialSearchResult {
  summary: Record<TrialAssessment, number>
  results: TrialMatch[]
  not_matches_hidden: boolean
  disclaimer: string
  profile: TrialProfile
  /** The condition text actually sent to ClinicalTrials.gov. */
  search_term: string
}

export interface TrialSource {
  title: string
  url: string
  domain: string
  category: string
  evidence_quote: string
  published_at?: string | null
}

/** Response of POST /api/trials/research. */
export interface TrialDossier {
  nct_id: string
  sources: TrialSource[]
  review_note: string
}

/** Router state for the slide analysis page (demo mode: a file, if any, is never read or sent anywhere). */
export interface SlideUploadState {
  /** The held-out slide shown as the demo result. */
  slideId: string
  /** The file the user chose. Absent when they picked "Select test case" instead. */
  file?: { name: string; size: number }
}

/** One H&E tumour micrograph found by the Paperclip literature search. */
export interface Micrograph {
  id: string
  /** Path relative to the Paperclip dataset folder, e.g. images/thyroid_0001.jpg */
  image: string
  diagnosis: string
  site: string
  grade: string
  stage: string
  stain: string
  /** Approximate total magnification parsed from the paper (x100 to x600). */
  magnification: number | null
  specimen: string
  features: string
  caption: string
  study: string
  title: string
  year: number | null
  journal: string
  link: string
  pmcid: string
  /** Dataset QC flags, e.g. drawn arrows or ambiguous magnification. Empty when none. */
  qc: string
  qcNote: string
}

export interface Biomarker {
  tumour: string
  biomarker: string
  direction: string
  method: string
  value: string
  association: string
  comparator: string
  use: string
  quote: string
  study: string
  title: string
  year: number | null
  journal: string
  link: string
  note: string
}

/** What the labelled Biobase slides of an organ look like. */
export interface OrganProfile {
  slides: number | null
  diagnoses: string
  stages: string
  stains: string
  markers: string
  magnification: string
}

export interface PaperclipOrgan {
  micrographs: Micrograph[]
  biomarkers: Biomarker[]
  profile: OrganProfile | null
}

export interface PaperclipFile {
  dataset: string
  /** Keyed by Biobase organ group. An organ with no results may be absent (Esophagus has none). */
  organs: Record<string, PaperclipOrgan>
}
