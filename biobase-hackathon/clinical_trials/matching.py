"""Conservative, evidence-backed first-pass trial matching.

The matcher recognizes only a small set of high-value pathology requirements.
Anything it cannot parse remains reviewable official text; it never asserts final
clinical-trial eligibility.
"""

import math
import re
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional

from .models import PatientProfile, TrialRecord


HISTOLOGY_PATTERNS = {
    "lobular": r"\blobular\b|\bILC\b",
    "ductal": r"\bductal\b|\bIDC\b",
    "squamous": r"\bsquamous\b",
    "adenocarcinoma": r"\badenocarcinoma\b",
    "mucinous": r"\bmucinous\b",
    "clear cell": r"\bclear cell\b",
    "poorly cohesive": r"\bpoorly cohesive\b",
}
STAGE_VALUES = {"0": 0, "I": 1, "II": 2, "III": 3, "IV": 4}


@dataclass
class ClarificationQuestion:
    question_id: str
    prompt: str
    criterion_evidence: str
    yes_effect: str
    no_effect: str


@dataclass
class MatchAssessment:
    nct_id: str
    status: str
    assessment: str
    matched_facts: List[str] = field(default_factory=list)
    exclusions: List[str] = field(default_factory=list)
    unknown_requirements: List[str] = field(default_factory=list)
    clarification_questions: List[ClarificationQuestion] = field(default_factory=list)
    nearest_site: Optional[Dict[str, object]] = None
    distance_miles: Optional[float] = None
    location_status: Optional[str] = None
    source_url: Optional[str] = None
    source_retrieved_at: Optional[str] = None
    source_last_updated: Optional[str] = None
    review_note: str = "Likely relevance only; coordinator and investigator must confirm eligibility."

    def to_dict(self):
        return asdict(self)


def _age_in_years(text: Optional[str]):
    if not text or text.upper() in ("N/A", "NA"):
        return None
    match = re.match(r"\s*(\d+)\s*(year|years)\b", text, re.I)
    return int(match.group(1)) if match else None


def _eligibility_sections(text):
    text = text or ""
    split = re.split(r"\bExclusion Criteria\s*:\s*", text, maxsplit=1, flags=re.I)
    inclusion = re.sub(r"^.*?\bInclusion Criteria\s*:\s*", "", split[0], flags=re.I | re.S)
    exclusion = split[1] if len(split) == 2 else ""
    return inclusion, exclusion


def _criterion_lines(text):
    return [re.sub(r"^[\s*•-]+", "", line).strip() for line in text.splitlines() if line.strip()]


def _answer_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if value.lower() == "yes":
            return True
        if value.lower() == "no":
            return False
    return None


def _check_boolean_requirement(key, prompt, evidence, expected, actual, answers, label,
                               matched, exclusions, questions):
    if actual is None:
        actual = _answer_value(answers.get(key))
    if actual is None:
        questions.append(ClarificationQuestion(
            question_id=key,
            prompt=prompt,
            criterion_evidence=evidence,
            yes_effect="Supports this requirement." if expected else "Would make this trial a known mismatch.",
            no_effect="Would make this trial a known mismatch." if expected else "Supports this requirement.",
        ))
    elif actual == expected:
        matched.append(label)
    else:
        exclusions.append("does not meet requirement: " + label)


def _required_histologies(inclusion):
    found = []
    evidence = None
    for line in _criterion_lines(inclusion):
        line_found = [name for name, pattern in HISTOLOGY_PATTERNS.items() if re.search(pattern, line, re.I)]
        if line_found:
            found.extend(line_found)
            evidence = evidence or line
    return sorted(set(found)), evidence


def _biomarker_requirements(inclusion):
    requirements = []
    aliases = {
        "ER": r"(?:\bER\b|estrogen receptor)",
        "PR": r"(?:\bPR\b|progesterone receptor)",
        "HER2": r"(?:\bHER2\b|human epidermal growth factor receptor 2)",
    }
    for line in _criterion_lines(inclusion):
        for marker, alias in aliases.items():
            positive = re.search(alias + r"\s*(?:\+|[- ]?positive\b)", line, re.I)
            negative = re.search(alias + r"\s*(?:-|[- ]?negative\b)", line, re.I)
            mutated = marker == "HER2" and re.search(alias + r"[- ]?mutat(?:ed|ion)", line, re.I)
            percent_positive = marker in ("ER", "PR") and re.search(alias, line, re.I) and re.search(
                r"(?:≥|>=|greater than or equal to)\s*1\s*(?:%|percent)", line, re.I,
            )
            state = "mutated" if mutated else "positive" if positive or percent_positive else "negative" if negative else None
            if state:
                requirements.append((marker, state, line))
    unique = {}
    for marker, state, line in requirements:
        unique.setdefault(marker, (state, line))
    return unique


def _stage_requirement(inclusion):
    for line in _criterion_lines(inclusion):
        match = re.search(r"\bstage\s+(0|I{1,3}|IV)\s*[-–]\s*(0|I{1,3}|IV)\b", line, re.I)
        if match:
            low, high = STAGE_VALUES[match.group(1).upper()], STAGE_VALUES[match.group(2).upper()]
            return set(range(low, high + 1)), line
        match = re.search(r"\bstage\s+(0|I{1,3}|IV)\b", line, re.I)
        if match:
            return {STAGE_VALUES[match.group(1).upper()]}, line
    return None, None


def _profile_stage(stage):
    match = re.search(r"\bstage\s+(0|I{1,3}|IV)\b", stage or "", re.I)
    return STAGE_VALUES.get(match.group(1).upper()) if match else None


def _minimum_tumor_size(inclusion):
    for line in _criterion_lines(inclusion):
        match = re.search(
            r"(?:minimum\s+tumou?r\s+size|tumou?r\s+(?:size\s+)?(?:of\s+)?(?:at least|>=|≥))"
            r"[^\d]{0,12}(\d+(?:\.\d+)?)\s*(mm|cm)\b",
            line,
            re.I,
        )
        if match:
            value = float(match.group(1)) * (10 if match.group(2).lower() == "cm" else 1)
            return value, line
    return None, None


def _metastatic_requirement(inclusion, exclusion):
    for line in _criterion_lines(inclusion):
        if re.match(r"^(?:patients? with )?(?:distant )?metastatic\b", line, re.I):
            return True, line
    for line in _criterion_lines(exclusion):
        if re.match(r"^(?:evidence of )?(?:distant )?metastatic disease\b", line, re.I):
            return False, line
    return None, None


def _treatment_naive_requirement(inclusion):
    for line in _criterion_lines(inclusion):
        if re.search(r"\b(?:no prior treatment|treatment[- ]naive)\b", line, re.I):
            return True, line
    return None, None


def _distance_miles(lat1, lon1, lat2, lon2):
    radius = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _location_result(profile, trial):
    location = profile.location
    if location.get("latitude") is None or location.get("longitude") is None:
        return None, None, None
    candidates = []
    for site in trial.locations:
        if site.get("latitude") is None or site.get("longitude") is None:
            continue
        distance = _distance_miles(
            float(location["latitude"]), float(location["longitude"]),
            float(site["latitude"]), float(site["longitude"]),
        )
        candidates.append((distance, site))
    if not candidates:
        return None, None, "distance_unavailable"
    distance, site = min(candidates, key=lambda item: item[0])
    radius = location.get("radius_miles")
    status = "within_preferred_radius" if radius is None or distance <= float(radius) else "outside_preferred_radius"
    return site, round(distance, 1), status


def assess(profile: PatientProfile, trial: TrialRecord, answers=None) -> MatchAssessment:
    """Assess likely relevance and return questions that can update the result."""
    answers = answers or {}
    matched, exclusions, questions = [], [], []
    profile_organ = profile.primary_organ.lower()
    searchable_text = " ".join(trial.conditions + [trial.title]).lower()
    if profile_organ in searchable_text:
        matched.append("condition mentions " + profile.primary_organ)
    else:
        exclusions.append("trial condition does not mention " + profile.primary_organ)

    if profile.age_years is None:
        questions.append(ClarificationQuestion(
            "age_in_range", "Is the patient within the published trial age range?",
            "{} to {}".format(trial.minimum_age or "no minimum", trial.maximum_age or "no maximum"),
            "Supports the age requirement.", "Would make this trial a known mismatch.",
        ))
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
        questions.append(ClarificationQuestion(
            "sex_matches", "Does the patient's recorded sex match this requirement?",
            trial.sexes_eligible or "All sexes", "Supports the requirement.", "Would make this trial a known mismatch.",
        ))
    elif trial_sex in ("ALL", "BOTH", "ALL SEXES"):
        matched.append("trial accepts all sexes")
    elif trial_sex == profile.sex.upper():
        matched.append("sex matches published eligibility")
    else:
        exclusions.append("trial eligibility is limited to {}".format(trial.sexes_eligible))

    inclusion, exclusion = _eligibility_sections(trial.eligibility_text)

    histologies, evidence = _required_histologies(inclusion)
    if histologies:
        actual = None if not profile.histology else any(h in profile.histology.lower() for h in histologies)
        label = "histology matches " + " or ".join(histologies)
        _check_boolean_requirement(
            "histology_matches", "Does pathology confirm {} histology?".format(" or ".join(histologies)),
            evidence, True, actual, answers, label, matched, exclusions, questions,
        )

    for marker, (required, evidence) in _biomarker_requirements(inclusion).items():
        observed = {k.upper(): str(v).lower() for k, v in profile.biomarkers.items()}.get(marker)
        actual = None if observed is None else observed == required
        label = "{} is {}".format(marker, required)
        _check_boolean_requirement(
            "{}_{}_required".format(marker.lower(), required),
            "Is {} {}?".format(marker, required), evidence, True, actual, answers,
            label, matched, exclusions, questions,
        )

    allowed_stages, evidence = _stage_requirement(inclusion)
    if allowed_stages:
        observed_stage = _profile_stage(profile.stage)
        actual = None if observed_stage is None else observed_stage in allowed_stages
        inverse_stage = {value: key for key, value in STAGE_VALUES.items()}
        label = "overall stage is within " + ", ".join("Stage " + inverse_stage[n] for n in sorted(allowed_stages))
        _check_boolean_requirement(
            "stage_matches", "Is the patient's overall stage within the trial range?", evidence,
            True, actual, answers, label, matched, exclusions, questions,
        )

    metastatic_required, evidence = _metastatic_requirement(inclusion, exclusion)
    if metastatic_required is not None:
        observed = None
        if profile.metastatic_status in ("metastatic", "non_metastatic"):
            observed = profile.metastatic_status == "metastatic"
        _check_boolean_requirement(
            "has_metastatic_disease", "Does the patient have distant metastatic disease?", evidence,
            metastatic_required, observed, answers, "metastatic status matches trial requirement",
            matched, exclusions, questions,
        )

    minimum_size, evidence = _minimum_tumor_size(inclusion)
    if minimum_size is not None:
        actual = None if profile.tumor_size_mm is None else profile.tumor_size_mm >= minimum_size
        label = "tumor size is at least {} mm".format(minimum_size)
        _check_boolean_requirement(
            "minimum_tumor_size", "Is the tumor at least {} mm?".format(minimum_size), evidence,
            True, actual, answers, label, matched, exclusions, questions,
        )

    treatment_required, evidence = _treatment_naive_requirement(inclusion)
    if treatment_required is not None:
        _check_boolean_requirement(
            "treatment_naive", "Has the patient received no prior treatment for the current diagnosis?", evidence,
            True, profile.treatment_naive, answers, "no prior treatment for current diagnosis",
            matched, exclusions, questions,
        )

    nearest, distance, location_status = _location_result(profile, trial)
    if location_status == "within_preferred_radius":
        matched.append("recruiting site is within preferred radius")

    unknown = [question.question_id for question in questions]
    assessment = "not_a_match" if exclusions else "needs_more_information" if questions else "likely_relevant"
    return MatchAssessment(
        nct_id=trial.nct_id,
        status=trial.status,
        assessment=assessment,
        matched_facts=matched,
        exclusions=exclusions,
        unknown_requirements=unknown,
        clarification_questions=questions,
        nearest_site=nearest,
        distance_miles=distance,
        location_status=location_status,
        source_url=trial.official_url,
        source_retrieved_at=trial.retrieved_at,
        source_last_updated=trial.last_update_posted,
    )
