import type { AnalysisResult } from '../types'

export class AnalyzeError extends Error {}

/** Send report text to the local analysis API. Errors carry a message that is safe to show. */
export async function analyzeReport(text: string): Promise<AnalysisResult> {
  let res: Response
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    throw new AnalyzeError('Could not reach the analysis service. Start it with "npm run api" in frontend/.')
  }
  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    // A string detail is ours (unsupported report); anything else is FastAPI's schema validation (e.g. too large).
    throw new AnalyzeError(typeof body?.detail === 'string' ? body.detail : 'The report could not be read (is it too large?).')
  }
  if (!res.ok) throw new AnalyzeError(`The analysis service failed (${res.status}).`)
  return res.json() as Promise<AnalysisResult>
}
