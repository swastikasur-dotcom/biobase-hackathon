"""Adapter for the current Task A parsed-report dictionary.

The adapter deliberately takes a dictionary instead of importing Task A. This
keeps the clinical-trial layer compatible with future parser/model changes.
"""

import re

from .models import PatientProfile


def profile_from_task_a_fields(fields, patient_reference=None):
    """Create a conservative profile from ``task_a.parse_reports.parse`` output.

    Task A supplies age *bands*, not an exact age. The adapter preserves the band
    as evidence but does not invent ``age_years``; the UI or EHR integration must
    provide an exact age before age-based trial screening.
    """
    organ = fields.get("organ")
    if not organ:
        raise ValueError("Task A fields need an organ before trial discovery")
    sex = {"F": "female", "M": "male"}.get(fields.get("sex"), "unknown")
    biomarkers = _biomarkers(fields)
    tumor_size_mm = _tumor_size_mm(fields.get("Tumor size", ""))
    facts = {}
    for source, target in (
        ("age_band", "age_band"),
        ("Tumor size", "tumor_size"),
        ("Lymph nodes", "lymph_nodes"),
        ("Nottingham grade", "nottingham_grade"),
        ("ISUP grade", "isup_grade"),
        ("Pathologic stage (AJCC 8th ed.)", "pathologic_stage"),
    ):
        if fields.get(source):
            facts[target] = fields[source]
    return PatientProfile(
        primary_organ=organ,
        patient_reference=patient_reference,
        sex=sex,
        histology=fields.get("Histologic type") or fields.get("Diagnosis"),
        stage=fields.get("Pathologic stage (AJCC 8th ed.)") or fields.get("Pathologic stage"),
        tumor_size_mm=tumor_size_mm,
        biomarkers=biomarkers,
        pathology_facts=facts,
        fact_sources={key: "pathology_report" for key in facts},
    )


def _biomarkers(fields):
    values = {}
    text = fields.get("Biomarkers", "")
    for marker in ("ER", "PR", "HER2"):
        match = re.search(r"\b{}\s+(positive|negative|equivocal|low)\b".format(marker), text, re.I)
        if match:
            values[marker] = match.group(1).lower()
    if fields.get("HER2"):
        match = re.search(r"\b(positive|negative|equivocal|low)\b", fields["HER2"], re.I)
        if match:
            values["HER2"] = match.group(1).lower()
    return values


def _tumor_size_mm(text):
    match = re.search(r"([\d.]+)\s*(mm|cm)\b", text, re.I)
    if not match:
        return None
    value = float(match.group(1))
    return value * 10 if match.group(2).lower() == "cm" else value
