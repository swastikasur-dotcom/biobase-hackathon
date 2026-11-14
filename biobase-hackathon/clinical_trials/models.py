"""JSON-compatible contracts shared by profile extraction, trial search, and UI."""

from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional


@dataclass
class PatientProfile:
    """Minimum, de-identified profile used to discover trials.

    ``patient_reference`` is an application-local opaque ID. Never send a name,
    medical-record number, report text, or other direct identifier to a public
    search service.
    """

    primary_organ: str
    patient_reference: Optional[str] = None
    age_years: Optional[int] = None
    sex: Optional[str] = None
    histology: Optional[str] = None
    stage: Optional[str] = None
    biomarkers: Dict[str, str] = field(default_factory=dict)
    pathology_facts: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, value):
        if not isinstance(value, dict):
            raise ValueError("Patient profile must be an object")
        organ = value.get("primary_organ")
        if not isinstance(organ, str) or not organ.strip():
            raise ValueError("Patient profile requires primary_organ")
        age = value.get("age_years")
        if age is not None and (not isinstance(age, int) or age < 0 or age > 130):
            raise ValueError("age_years must be an integer from 0 to 130")
        sex = value.get("sex")
        if sex is not None and sex not in ("female", "male", "intersex", "unknown"):
            raise ValueError("sex must be female, male, intersex, unknown, or omitted")
        return cls(
            primary_organ=organ.strip(),
            patient_reference=value.get("patient_reference"),
            age_years=age,
            sex=sex,
            histology=value.get("histology"),
            stage=value.get("stage"),
            biomarkers=dict(value.get("biomarkers") or {}),
            pathology_facts=dict(value.get("pathology_facts") or {}),
        )

    def to_dict(self):
        return asdict(self)

    def search_condition(self):
        """Return only disease descriptors suitable for a public registry query."""
        return " ".join(x for x in (self.primary_organ, self.histology) if x).strip()


@dataclass
class TrialRecord:
    """Normalized subset of an official ClinicalTrials.gov study record."""

    nct_id: str
    title: str
    status: str
    conditions: List[str] = field(default_factory=list)
    interventions: List[str] = field(default_factory=list)
    eligibility_text: Optional[str] = None
    sexes_eligible: Optional[str] = None
    minimum_age: Optional[str] = None
    maximum_age: Optional[str] = None
    locations: List[Dict[str, str]] = field(default_factory=list)
    official_url: Optional[str] = None

    def to_dict(self):
        return asdict(self)
