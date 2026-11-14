"""Stable contracts for pathology-informed clinical-trial discovery.

This package intentionally has no dependency on the task implementations or a web
framework.  A frontend or a revised task model can use its JSON-compatible
contracts without importing one another.
"""

from .models import PatientProfile, TrialRecord
from .clinicaltrials_gov import ClinicalTrialsGovClient
from .matching import assess
from .service import build_discovery_result

__all__ = [
    "PatientProfile", "TrialRecord", "ClinicalTrialsGovClient", "assess",
    "build_discovery_result",
]
