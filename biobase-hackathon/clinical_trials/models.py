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
    metastatic_status: Optional[str] = None
    tumor_size_mm: Optional[float] = None
    treatment_naive: Optional[bool] = None
    biomarkers: Dict[str, str] = field(default_factory=dict)
    pathology_facts: Dict[str, str] = field(default_factory=dict)
    fact_sources: Dict[str, str] = field(default_factory=dict)
    location: Dict[str, object] = field(default_factory=dict)

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
        metastatic_status = value.get("metastatic_status")
        if metastatic_status not in (None, "metastatic", "non_metastatic", "unknown"):
            raise ValueError("metastatic_status must be metastatic, non_metastatic, unknown, or omitted")
        tumor_size = value.get("tumor_size_mm")
        if tumor_size is not None and (not isinstance(tumor_size, (int, float)) or tumor_size < 0):
            raise ValueError("tumor_size_mm must be a non-negative number")
        treatment_naive = value.get("treatment_naive")
        if treatment_naive is not None and not isinstance(treatment_naive, bool):
            raise ValueError("treatment_naive must be true, false, or omitted")
        return cls(
            primary_organ=organ.strip(),
            patient_reference=value.get("patient_reference"),
            age_years=age,
            sex=sex,
            histology=value.get("histology"),
            stage=value.get("stage"),
            metastatic_status=metastatic_status,
            tumor_size_mm=float(tumor_size) if tumor_size is not None else None,
            treatment_naive=treatment_naive,
            biomarkers=dict(value.get("biomarkers") or {}),
            pathology_facts=dict(value.get("pathology_facts") or {}),
            fact_sources=dict(value.get("fact_sources") or {}),
            location=dict(value.get("location") or {}),
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
    locations: List[Dict[str, object]] = field(default_factory=list)
    official_url: Optional[str] = None
    source: str = "ClinicalTrials.gov"
    retrieved_at: Optional[str] = None
    last_update_posted: Optional[str] = None

    def to_dict(self):
        return asdict(self)
