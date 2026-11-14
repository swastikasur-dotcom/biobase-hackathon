"""Analyse one uploaded pathology report with the validated Task A parser and rules.

analyze(text) -> dict with the parsed fields, the criteria the report matches (with the
fields each rule reads as evidence), same-organ criteria it does not match, and a plain-language
summary built from the parsed fields by template (no LLM, nothing leaves this process).

The rules themselves are imported unchanged from biobase-hackathon/task_a.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
BIOBASE = os.environ.get("BIOBASE_DIR") or REPO
os.environ["BIOBASE_DIR"] = BIOBASE  # parse_reports reads this at import time

sys.path.insert(0, os.path.join(REPO, "biobase-hackathon", "task_a"))
from criteria_rules import RULES  # noqa: E402
from parse_reports import ORGAN_WORDS, parse  # noqa: E402

SUPPORTED_ORGANS = [o for o, _ in ORGAN_WORDS]

# Organ of each criterion, read from the rule definitions in criteria_rules.py.
CRITERION_ORGAN = {
    **{f"c{i:02d}": "breast" for i in range(1, 8)},
    **{f"c{i:02d}": "colon" for i in range(8, 14)},
    **{f"c{i:02d}": "lung" for i in range(14, 17)},
    **{f"c{i:02d}": "prostate" for i in range(17, 21)},
    **{f"c{i:02d}": "stomach" for i in range(21, 24)},
    **{f"c{i:02d}": "kidney" for i in range(24, 27)},
    "c27": "skin", "c28": "skin", "c29": "colon", "c30": "lung",
}

STAGE = "Pathologic stage (AJCC 8th ed.)"

# Parsed fields each rule reads. The rules do not record this themselves, so it is kept here
# by hand (checked by test_every_rule_has_evidence_fields) and shown as the "why".
EVIDENCE_FIELDS = {
    "c01": ["Biomarkers", "Lymph nodes"],
    "c02": ["Biomarkers"],
    "c03": ["Biomarkers"],
    "c04": ["Lymphovascular invasion", "Tumor size"],
    "c05": ["Margins"],
    "c06": ["Tumor focality", "age_band"],
    "c07": ["Nottingham grade", "Lymphovascular invasion"],
    "c08": [STAGE],
    "c09": ["Histologic type"],
    "c10": ["Tumor deposits"],
    "c11": ["Lymph nodes", "Lymphovascular invasion"],
    "c12": [STAGE],
    "c13": ["Tumor size", "Perineural invasion"],
    "c14": ["Visceral pleural invasion"],
    "c15": ["Histologic type", "Margins"],
    "c16": ["Histologic type", "Lymph nodes"],
    "c17": ["Gleason score"],
    "c18": ["Seminal vesicle invasion"],
    "c19": ["Margins", "Extraprostatic extension"],
    "c20": ["Perineural invasion", "Lymphovascular invasion"],
    "c21": ["HER2"],
    "c22": ["Histologic type", "Lymph nodes"],
    "c23": [STAGE],
    "c24": ["Histologic type", "ISUP grade"],
    "c25": ["Sarcomatoid or rhabdoid features"],
    "c26": ["Extent of invasion"],
    "c27": ["Diagnosis", "Margins"],
    "c28": ["Diagnosis"],
    "c29": ["Lymph nodes", "age_band"],
    "c30": ["sex", "report_year"],
}

# Fields worth naming in the summary, in reading order.
SUMMARY_FIELDS = [
    "Histologic type", "Histologic grade", "Nottingham grade", "Gleason score", "ISUP grade", "Tumor size",
    STAGE, "Lymph nodes", "Margins", "Lymphovascular invasion", "Perineural invasion", "Biomarkers", "HER2",
]

MAX_CHARS = 200_000


class UnsupportedReport(ValueError):
    """The text is not a report this parser can read. The message is safe to show to the user."""


def _criteria_text():
    path = os.path.join(BIOBASE, "pack_reports", "criteria.json")
    try:
        return {c["id"]: c["text"] for c in json.load(open(path))}
    except FileNotFoundError:
        raise RuntimeError(f"criteria.json not found at {path}. Set BIOBASE_DIR to the Biobase data folder.") from None


CRITERIA_TEXT = _criteria_text()


def _evidence(fields, cid):
    out = []
    for key in EVIDENCE_FIELDS[cid]:
        if fields.get(key) not in (None, ""):
            out.append({"field": key, "value": str(fields[key])})
    return out


def _summary(fields, n_matches):
    sex = {"M": "male", "F": "female"}.get(fields.get("sex"), None)
    who = f"a {sex} patient" if sex else "a patient"
    if fields.get("age_band"):
        who += f" in the {fields['age_band']} age band"
    head = f"{fields['organ'].capitalize()} report for {who}"
    if fields.get("report_year"):
        head += f", reported in {fields['report_year']}"
    head += f". Specimen: {fields['specimen']}."

    diagnosis = fields.get("Diagnosis")
    findings = [f"{k.split(' (')[0].lower()}: {fields[k]}" for k in SUMMARY_FIELDS if fields.get(k)]
    parts = [head]
    if diagnosis:
        parts.append(f"Diagnosis: {diagnosis}.")
    if findings:
        parts.append("Key findings: " + "; ".join(findings) + ".")
    parts.append(
        f"It meets {n_matches} of the {len(RULES)} trial criteria."
        if n_matches else f"It meets none of the {len(RULES)} trial criteria."
    )
    return " ".join(parts)


def analyze(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise UnsupportedReport("The report is empty.")
    if len(text) > MAX_CHARS:
        raise UnsupportedReport(f"The report is too long ({len(text):,} characters; the limit is {MAX_CHARS:,}).")
    if "FINAL DIAGNOSIS:" not in text:
        raise UnsupportedReport(
            'No "FINAL DIAGNOSIS:" section found. This tool reads reports in the Biobase synthetic report format.'
        )

    parsed = parse(text)
    fields = {k: v for k, v in parsed.items() if not k.startswith("_")}
    organ = fields.get("organ")
    if not organ:
        raise UnsupportedReport(
            "Could not tell which organ the specimen is from. Supported organs: " + ", ".join(SUPPORTED_ORGANS) + "."
        )

    warnings = []
    for key, label in (("sex", "patient sex"), ("age_band", "age band"), ("report_year", "report year")):
        if key not in fields:
            warnings.append(f"Could not read the {label}; criteria that depend on it are treated as not matched.")

    matched, others = [], []
    for cid, rule in RULES.items():
        try:
            hit = bool(rule(parsed))
        except Exception:  # noqa: BLE001  rules assume well-formed fields; a malformed upload must not crash the API
            hit = False
            warnings.append(f"Criterion {cid} could not be evaluated on this report.")
        entry = {"id": cid, "text": CRITERIA_TEXT[cid], "evidence": _evidence(fields, cid)}
        if hit:
            matched.append(entry)
        elif CRITERION_ORGAN[cid] == organ:
            others.append(entry)

    return {
        "organ": organ,
        "fields": fields,
        "matches": matched,
        "not_matched": others,
        "summary": _summary(fields, len(matched)),
        "warnings": warnings,
    }
