import type { PatientsForTrial, ProfileFromReport, TrialAnswers, TrialDossier, TrialProfile, TrialSearchResult } from '../types'

export class TrialsError extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api/trials/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new TrialsError('Could not reach the local service. Start it with "npm run api" in frontend/.')
  }
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { detail?: unknown } | null)?.detail
    // A string detail is ours and safe to show; anything else is FastAPI's schema validation.
    throw new TrialsError(typeof detail === 'string' ? detail : `The request failed (${res.status}).`)
  }
  return res.json() as Promise<T>
}

/** Read a de-identified profile out of a pathology report. The report is processed locally. */
export const profileFromReport = (reportText: string) => post<ProfileFromReport>('profile', { report_text: reportText })

/** Search ClinicalTrials.gov. Only organ, histology and an optional city/ZIP leave the local service. */
export const searchTrials = (args: { profile: TrialProfile; answers: TrialAnswers; includeExcluded: boolean }) =>
  post<TrialSearchResult>('search', {
    profile: args.profile,
    answers_by_trial: args.answers,
    include_not_matches: args.includeExcluded,
    page_size: 10,
  })

/** The test reports that best fit one registered trial. The trial is the only thing sent to ClinicalTrials.gov. */
export const patientsForTrial = (trial: string) => post<PatientsForTrial>('patients', { trial, limit: 50 })

/** Cited public-web sources for one trial. Needs the optional research provider on the backend. */
export const researchTrial = (trial: { nct_id: string; title: string; last_update_posted: string | null }) =>
  post<TrialDossier>('research', { nct_id: trial.nct_id, title: trial.title, registry_last_updated: trial.last_update_posted })
