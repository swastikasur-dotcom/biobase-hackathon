"""Stable contracts for pathology-informed clinical-trial discovery.

This package intentionally has no dependency on the task implementations or a web
framework.  A frontend or a revised task model can use its JSON-compatible
contracts without importing one another.
"""

from .models import PatientProfile, TrialRecord

__all__ = ["PatientProfile", "TrialRecord"]
