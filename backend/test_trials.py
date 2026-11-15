"""Tests for the trial-discovery routes. The registry client is faked: no network."""
import pytest
import trials
from clinical_trials.models import TrialRecord
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

REPORT = """SURGICAL PATHOLOGY REPORT (SYNTHETIC; NOT A REAL PATIENT)
Patient: F, age band 60-69 | Report year: 2023

SPECIMEN: Breast, left, lumpectomy

FINAL DIAGNOSIS: Histologic type: Invasive carcinoma of no special type (ductal); Tumor size: 45 mm; Nottingham grade: 3; Lymph nodes: 2 of 12 positive; Biomarkers: ER negative; PR negative; HER2 negative; Pathologic stage (AJCC 8th ed.): pT2 pN1a
"""


class FakeClient:
    def __init__(self):
        self.conditions = []

    def search_open_trials(self, profile, page_size=20):
        self.conditions.append(profile.search_condition())
        return [
            TrialRecord(
                nct_id="NCT00000001", title="Breast study", status="RECRUITING", conditions=["Breast Cancer"],
                eligibility_text="Inclusion Criteria:\n- Breast cancer\nExclusion Criteria:\n- None",
                sexes_eligible="ALL", minimum_age="18 Years", official_url="https://clinicaltrials.gov/study/NCT00000001",
            )
        ]


@pytest.fixture
def fake(monkeypatch):
    f = FakeClient()
    monkeypatch.setattr(trials, "CLIENT", f)
    return f


def test_profile_is_read_from_the_report_without_inventing_an_exact_age():
    r = client.post("/api/trials/profile", json={"report_text": REPORT})
    assert r.status_code == 200
    p = r.json()["profile"]
    assert p["primary_organ"] == "breast" and p["sex"] == "female"
    assert p["biomarkers"] == {"ER": "negative", "PR": "negative", "HER2": "negative"}
    assert p["age_years"] is None and p["pathology_facts"]["age_band"] == "60-69"


def test_profile_rejects_empty_and_unreadable_reports():
    assert client.post("/api/trials/profile", json={"report_text": "   "}).status_code == 422
    assert client.post("/api/trials/profile", json={"report_text": "hello world"}).status_code == 422


def test_search_returns_ranked_results_and_the_registry_search_term(fake):
    profile = client.post("/api/trials/profile", json={"report_text": REPORT}).json()["profile"]
    profile["age_years"] = 62
    r = client.post("/api/trials/search", json={"profile": profile})
    assert r.status_code == 200
    body = r.json()
    assert body["search_term"] == "breast invasive ductal carcinoma"  # shortened for the registry query
    assert fake.conditions == ["breast invasive ductal carcinoma"]
    assert body["profile"]["histology"] == "Invasive carcinoma of no special type (ductal)"  # user's value unchanged
    assert body["summary"]["likely_relevant"] + body["summary"]["needs_more_information"] == 1
    assert body["results"][0]["trial"]["official_url"].endswith("NCT00000001")
    assert "Pre-screening" in body["disclaimer"]


def test_search_rejects_a_profile_without_an_organ(fake):
    assert client.post("/api/trials/search", json={"profile": {"histology": "x"}}).status_code == 422


def test_registry_failure_is_a_502_naming_the_service(monkeypatch):
    class Boom:
        def search_open_trials(self, *a, **k):
            raise OSError("timed out")

    monkeypatch.setattr(trials, "CLIENT", Boom())
    r = client.post("/api/trials/search", json={"profile": {"primary_organ": "breast"}})
    assert r.status_code == 502 and "ClinicalTrials.gov" in r.json()["detail"]


@pytest.mark.parametrize(
    "histology,expected",
    [
        ("Invasive carcinoma of no special type (ductal)", "invasive ductal carcinoma"),
        ("squamous cell carcinoma, keratinizing", "squamous cell carcinoma"),
        ("invasive non-mucinous adenocarcinoma, predominant pattern acinar; high-grade patterns 0%", "invasive non-mucinous adenocarcinoma"),
        ("Acinar adenocarcinoma", "Acinar adenocarcinoma"),
        (None, None),
    ],
)
def test_search_histology_shortens_report_wording(histology, expected):
    assert trials.search_histology(histology) == expected


def test_research_is_503_when_the_optional_provider_is_missing(monkeypatch):
    monkeypatch.setattr(trials, "_research_provider", None)
    import builtins

    real = builtins.__import__

    def no_keenable(name, *a, **k):
        if name == "keenable":
            raise ImportError("no keenable")
        return real(name, *a, **k)

    monkeypatch.setattr(builtins, "__import__", no_keenable)
    r = client.post("/api/trials/research", json={"nct_id": "NCT02918474"})
    assert r.status_code == 503 and "keenable" in r.json()["detail"].lower()


def test_analyze_returns_rules_even_when_jev_is_unavailable(monkeypatch):
    import jev
    from fastapi.testclient import TestClient
    from main import app

    monkeypatch.delenv("JEV_API_KEY", raising=False)
    text = "FINAL DIAGNOSIS: Invasive ductal carcinoma, breast. ER positive."
    r = TestClient(app).post("/api/analyze", json={"text": text})
    if r.status_code == 200:
        body = r.json()
        assert body["jev"] is None and "JEV_API_KEY" in body["jev_error"]
    with __import__("pytest").raises(jev.JevUnavailable):
        jev.score("x")


def test_patients_for_trial_ranks_reports_and_validates_input(monkeypatch):
    monkeypatch.setattr(trials, "fetch_trial", lambda nct: TrialRecord(
        nct_id=nct, title="Breast study", status="RECRUITING", conditions=["Breast Cancer"],
        eligibility_text="Inclusion Criteria:\n- Breast cancer\nExclusion Criteria:\n- None", sexes_eligible="ALL", minimum_age="18 Years"))
    r = client.post("/api/trials/patients", json={"trial": "see https://clinicaltrials.gov/study/NCT00000009 ok", "limit": 3})
    assert r.status_code == 200
    body = r.json()
    assert body["trial"]["nct_id"] == "NCT00000009" and len(body["results"]) <= 9
    assert sum(body["summary"].values()) > 0
    assert set(body["shown"]) == {"likely_relevant", "needs_more_information", "not_a_match"}
    assert all(v <= 3 for v in body["shown"].values())  # the limit applies to each category
    assert client.post("/api/trials/patients", json={"trial": "not a trial"}).status_code == 422
