import json
import os

import pytest
from analysis import BIOBASE, CRITERION_ORGAN, EVIDENCE_FIELDS, RULES, UnsupportedReport, analyze
from fastapi.testclient import TestClient
from main import app

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_JSONL = os.path.join(BIOBASE, "pack_reports", "test.jsonl")
SUBMISSION = os.path.join(REPO, "biobase-hackathon", "task_a", "submission_criteria.json")

needs_data = pytest.mark.skipif(not os.path.exists(TEST_JSONL), reason="Biobase data not available")


def _reports():
    return [json.loads(line) for line in open(TEST_JSONL)]


def test_every_rule_has_evidence_fields_and_an_organ():
    assert set(EVIDENCE_FIELDS) == set(RULES) == set(CRITERION_ORGAN)


@needs_data
def test_matches_equal_the_validated_submission_for_every_test_report():
    submitted = json.load(open(SUBMISSION))
    expected = {}
    for cid, ids in submitted.items():
        for rid in ids:
            expected.setdefault(rid, set()).add(cid)
    for r in _reports():
        got = {m["id"] for m in analyze(r["report_text"])["matches"]}
        assert got == expected.get(r["id"], set()), r["id"]


@needs_data
def test_criterion_organ_map_agrees_with_the_data():
    submitted = json.load(open(SUBMISSION))
    organ_of = {r["id"]: analyze(r["report_text"])["organ"] for r in _reports()}
    for cid, ids in submitted.items():
        assert {organ_of[i] for i in ids} <= {CRITERION_ORGAN[cid]}, cid


@needs_data
def test_result_shape_and_not_matched_are_same_organ():
    r = next(r for r in _reports() if analyze(r["report_text"])["matches"])
    out = analyze(r["report_text"])
    assert out["summary"].startswith(f"{out['organ'].capitalize()} report for")
    assert "Specimen:" in out["summary"]
    assert all(CRITERION_ORGAN[c["id"]] == out["organ"] for c in out["not_matched"])
    assert not {c["id"] for c in out["matches"]} & {c["id"] for c in out["not_matched"]}
    assert all(e["value"] for m in out["matches"] for e in m["evidence"])


@pytest.mark.parametrize("text,fragment", [
    ("", "empty"),
    ("just some words", "FINAL DIAGNOSIS"),
    ("FINAL DIAGNOSIS: something\nSPECIMEN: Spleen", "organ"),
    ("x" * 300_000 + "FINAL DIAGNOSIS:", "too long"),
])
def test_unsupported_text_gives_a_clear_error(text, fragment):
    with pytest.raises(UnsupportedReport, match=fragment):
        analyze(text)


def test_missing_demographics_warn_instead_of_crashing():
    text = "SPECIMEN: Colon, colectomy\n\nFINAL DIAGNOSIS:\n  Histologic type: Adenocarcinoma\n  Lymph nodes: 2 of 12 positive\n\nGROSS DESCRIPTION: x"
    out = analyze(text)
    assert out["organ"] == "colon"
    assert any("age band" in w for w in out["warnings"])
    assert any("c29" in w for w in out["warnings"])  # c29 reads age_band and cannot be evaluated


def test_api_validation_and_success():
    client = TestClient(app)
    assert client.get("/api/health").json() == {"ok": True}
    bad = client.post("/api/analyze", json={"text": "hello"})
    assert bad.status_code == 422 and "FINAL DIAGNOSIS" in bad.json()["detail"]
    assert client.post("/api/analyze", json={}).status_code == 422
    assert client.post("/api/analyze", json={"text": "x" * 400_000}).status_code == 422
