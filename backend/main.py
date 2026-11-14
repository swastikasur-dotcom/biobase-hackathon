"""Local API for the frontend. Run: backend/.venv/bin/uvicorn main:app --port 8000 (from backend/)."""
import jev
import trials
from analysis import MAX_CHARS, UnsupportedReport, analyze
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Biobase report analysis")


class AnalyzeRequest(BaseModel):
    # Slightly above MAX_CHARS so analysis.py gives the friendly "too long" message.
    text: str = Field(max_length=MAX_CHARS + 1000)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/analyze")
def analyze_report(req: AnalyzeRequest):
    try:
        result = analyze(req.text)
    except UnsupportedReport as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    # Jev is a second opinion: if it is unavailable the rule results are still returned.
    try:
        result["jev"] = jev.score(req.text)
        result["jev_error"] = None
    except jev.JevUnavailable as e:
        result["jev"] = None
        result["jev_error"] = str(e)
    return result


# ---- Clinical-trial discovery (ClinicalTrials.gov) ----


class ParseReportRequest(BaseModel):
    report_text: str = Field(max_length=MAX_CHARS + 1000)


class TrialSearchRequest(BaseModel):
    profile: dict
    answers_by_trial: dict[str, dict[str, str]] = {}
    include_not_matches: bool = False
    page_size: int = Field(default=10, ge=1, le=50)


class TrialResearchRequest(BaseModel):
    nct_id: str
    title: str | None = None
    registry_last_updated: str | None = None


def _bad_request(e: Exception):
    return HTTPException(status_code=422, detail=str(e))


def _upstream(name: str, e: Exception):
    return HTTPException(status_code=502, detail=f"{name} request failed: {e}")


@app.post("/api/trials/profile")
def trials_profile(req: ParseReportRequest):
    try:
        return trials.parse_report(req.report_text)
    except ValueError as e:
        raise _bad_request(e) from None


@app.post("/api/trials/search")
def trials_search(req: TrialSearchRequest):
    try:
        return trials.search(req.model_dump())
    except (ValueError, TypeError) as e:
        raise _bad_request(e) from None
    except Exception as e:  # network or registry failure: say which service, keep the message short
        raise _upstream("ClinicalTrials.gov", e) from None


@app.post("/api/trials/research")
def trials_research(req: TrialResearchRequest):
    try:
        return trials.research(req.model_dump())
    except trials.ResearchUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from None
    except ValueError as e:
        raise _bad_request(e) from None
    except Exception as e:
        raise _upstream("Keenable", e) from None
