"""Conservative, explainable first-pass trial matching.

Only structured age and sex constraints can produce a known exclusion here.
Free-text inclusion/exclusion criteria are returned for coordinator review rather
than guessed at. This deliberately avoids claiming clinical-trial eligibility.
"""

import re
from dataclasses import asdict, dataclass, field
from typing import List, Optional

from .models import PatientProfile, TrialRecord


@dataclass
class MatchAssessment:
    nct_id: str
    status: str
    assessment: str
    matched_facts: List[str] = field(default_factory=list)
    exclusions: List[str] = field(default_factory=list)
    unknown_requirements: List[str] = field(default_factory=list)
    review_note: str = "Requires coordinator and investigator eligibility review."

    def to_dict(self):
        return asdict(self)


def _age_in_years(text: Optional[str]):
    if not text or text.upper() in ("N/A", "NA"):
        return None
    match = re.match(r"\s*(\d+)\s*(year|years)\b", text, re.I)
    return int(match.group(1)) if match else None


def assess(profile: PatientProfile, trial: TrialRecord) -> MatchAssessment:
    matched, exclusions, unknown = [], [], []
    profile_organ = profile.primary_organ.lower()
    searchable_text = " ".join(trial.conditions + [trial.title]).lower()
    if profile_organ in searchable_text:
        matched.append("condition mentions " + profile.primary_organ)
    else:
        unknown.append("condition relevance requires review")

    if profile.age_years is None:
        unknown.append("patient age")
    else:
        minimum, maximum = _age_in_years(trial.minimum_age), _age_in_years(trial.maximum_age)
        if minimum is not None and profile.age_years < minimum:
            exclusions.append("below trial minimum age of {}".format(trial.minimum_age))
        elif maximum is not None and profile.age_years > maximum:
            exclusions.append("above trial maximum age of {}".format(trial.maximum_age))
        else:
            matched.append("age meets published range")

    trial_sex = (trial.sexes_eligible or "ALL").upper()
    if profile.sex in (None, "unknown", "intersex"):
        unknown.append("sex eligibility")
    elif trial_sex in ("ALL", "BOTH", "ALL SEXES"):
        matched.append("trial accepts all sexes")
    elif trial_sex == profile.sex.upper():
        matched.append("sex matches published eligibility")
    else:
        exclusions.append("trial eligibility is limited to {}".format(trial.sexes_eligible))

    if profile.histology:
        unknown.append("histology requirement")
    if profile.stage:
        unknown.append("stage / disease-setting requirement")
    if profile.biomarkers:
        unknown.append("biomarker-specific requirement")
    unknown.extend(["prior therapy", "performance status", "organ function", "location and site availability"])

    status = "excluded_by_structured_field" if exclusions else "possible_candidate"
    return MatchAssessment(
        nct_id=trial.nct_id,
        status=trial.status,
        assessment=status,
        matched_facts=matched,
        exclusions=exclusions,
        unknown_requirements=unknown,
    )
