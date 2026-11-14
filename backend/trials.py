"""Clinical-trial discovery for the app, on top of the biobase-hackathon/clinical_trials package.

The package is framework-independent; this module only wires it to the app:
  parse_report(text)  -> editable, de-identified patient profile read from a pathology report
  search(payload)     -> ranked ClinicalTrials.gov studies with evidence and clarification questions
  research(payload)   -> cited public-web sources for one NCT id (needs the optional `keenable` package)

Privacy boundary (as documented in clinical_trials/README.md): the report text and detailed clinical facts
stay in this process. Only organ, histology and an optional city/ZIP leave it, for ClinicalTrials.gov
(and the city/ZIP for OpenStreetMap distance lookup).
"""
import os
import re
import sys

import analysis  # noqa: F401  (sets BIOBASE_DIR and the task_a import path before the parser is imported)

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "biobase-hackathon"))

from clinical_trials.cache import TTLCache  # noqa: E402
from clinical_trials.clinicaltrials_gov import ClinicalTrialsGovClient  # noqa: E402
from clinical_trials.geocoding import NominatimGeocoder  # noqa: E402
from clinical_trials.models import PatientProfile  # noqa: E402
from clinical_trials.service import build_discovery_result  # noqa: E402
from clinical_trials.task_a_adapter import profile_from_task_a_fields  # noqa: E402
from parse_reports import parse as parse_pathology_report  # noqa: E402

CLIENT = ClinicalTrialsGovClient(cache=TTLCache(ttl_seconds=900))
GEOCODER = NominatimGeocoder(cache=TTLCache(ttl_seconds=30 * 24 * 60 * 60))
_research_provider = None


class ResearchUnavailable(Exception):
    """The optional Keenable provider is not installed or not configured."""


def parse_report(report_text):
    if not isinstance(report_text, str) or not report_text.strip():
        raise ValueError("report_text is required")
    parsed = parse_pathology_report(report_text)
    try:
        profile = profile_from_task_a_fields(parsed, patient_reference="local")
    except ValueError:
        raise ValueError(
            "No organ could be found in this report. It needs the synthetic report format: a SPECIMEN line and a FINAL DIAGNOSIS section."
        ) from None
    return {
        "profile": profile.to_dict(),
        "parsed_fields": {k: v for k, v in parsed.items() if not k.startswith("_")},
        "review_note": (
            "Review and complete the extracted fields before searching. Age bands and pT/pN values do not "
            "establish exact age or overall stage."
        ),
    }


def _trial_summary(trial):
    return {
        "nct_id": trial.nct_id,
        "title": trial.title,
        "status": trial.status,
        "conditions": trial.conditions,
        "interventions": trial.interventions,
        "locations": trial.locations,
        "official_url": trial.official_url,
        "eligibility_text": trial.eligibility_text,
        "last_update_posted": trial.last_update_posted,
    }


def search_histology(histology):
    """Shorten a report's histology to a term the registry's condition search can match.

    Reports say things like 'invasive non-mucinous adenocarcinoma, predominant pattern acinar; ...' or
    'Invasive carcinoma of no special type (ductal)', which return no registry hits as written. The full text
    stays in the profile; only the query and the matching use the shortened term.
    """
    if not histology:
        return histology
    if re.search(r"no special type.*ductal|ductal.*no special type", histology, re.I):
        return "invasive ductal carcinoma"
    return re.split(r"[;,(]", histology, maxsplit=1)[0].strip() or histology


def search(payload):
    profile_data = dict(payload.get("profile") or {})
    location = dict(profile_data.get("location") or {})
    if location.get("query") and location.get("radius_miles") is not None:
        location.update(GEOCODER.geocode(location["query"]))
        profile_data["location"] = location
    shown = PatientProfile.from_dict(profile_data)  # what the user entered, returned unchanged
    profile_data["histology"] = search_histology(shown.histology)
    profile = PatientProfile.from_dict(profile_data)
    page_size = int(payload.get("page_size", 10))
    trials = CLIENT.search_open_trials(profile, page_size=page_size)
    output = build_discovery_result(
        profile,
        trials,
        answers_by_trial=payload.get("answers_by_trial") or {},
        include_not_matches=bool(payload.get("include_not_matches", False)),
    )
    by_id = {t.nct_id: _trial_summary(t) for t in trials}
    for result in output["results"]:
        result["trial"] = by_id[result["nct_id"]]
    output["profile"] = shown.to_dict()
    output["search_term"] = profile.search_condition()
    return output


def research(payload):
    global _research_provider
    if _research_provider is None:
        try:
            from clinical_trials.keenable_research import KeenableTrialResearchProvider

            _research_provider = KeenableTrialResearchProvider(cache=TTLCache(ttl_seconds=3600))
        except ImportError as e:
            raise ResearchUnavailable("Public-source research needs the 'keenable' package (pip install keenable==0.1.5).") from e
        except Exception as e:  # client construction can fail without credentials
            raise ResearchUnavailable(f"Public-source research is not configured: {e}") from e
    return _research_provider.research(
        payload.get("nct_id"), title=payload.get("title"), registry_last_updated=payload.get("registry_last_updated")
    )
