"""Frontend-facing orchestration for trial discovery results."""

from collections import Counter

from .matching import assess


def build_discovery_result(profile, trials, answers_by_trial=None, include_not_matches=False):
    """Return ranked visible results and a collapsed count of known mismatches."""
    answers_by_trial = answers_by_trial or {}
    assessed = [assess(profile, trial, answers_by_trial.get(trial.nct_id)) for trial in trials]
    order = {"likely_relevant": 0, "needs_more_information": 1, "not_a_match": 2}
    assessed.sort(key=lambda item: (
        order[item.assessment],
        item.location_status != "within_preferred_radius",
        item.distance_miles if item.distance_miles is not None else float("inf"),
        item.nct_id,
    ))
    counts = Counter(item.assessment for item in assessed)
    visible = assessed if include_not_matches else [item for item in assessed if item.assessment != "not_a_match"]
    return {
        "summary": {
            "likely_relevant": counts["likely_relevant"],
            "needs_more_information": counts["needs_more_information"],
            "not_a_match": counts["not_a_match"],
        },
        "results": [item.to_dict() for item in visible],
        "not_matches_hidden": not include_not_matches,
        "disclaimer": "Pre-screening only; the study team must confirm eligibility.",
    }
