"""Local API for the frontend. Run: backend/.venv/bin/uvicorn main:app --port 8000 (from backend/)."""
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
        return analyze(req.text)
    except UnsupportedReport as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
