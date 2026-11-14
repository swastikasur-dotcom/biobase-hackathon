export interface Criterion {
  id: string
  text: string
}

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
}

/** Router state passed from the upload page to the result page. */
export interface ResultLocationState {
  result: AnalysisResult
  /** The text that was analysed. */
  text: string
}

/** Router state for the slide analysis page (demo mode: a file, if any, is never read or sent anywhere). */
export interface SlideUploadState {
  /** The held-out slide shown as the demo result. */
  slideId: string
  /** The file the user chose. Absent when they picked "Select test case" instead. */
  file?: { name: string; size: number }
}
