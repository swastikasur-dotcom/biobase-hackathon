"""Jev (TypeSafe System One) scores for one report: P(meets criterion) for each of the 30 criteria.

Same request as task_a/jev_run.py: one call, one yes/no ("noul") question per criterion, asked from the
plain-English criterion text only (no rules). The key is read from JEV_API_KEY and never stored.
"""
import json
import os
import urllib.error
import urllib.request

from analysis import CRITERIA_TEXT

URL = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"


class JevUnavailable(Exception):
    """No key configured, or the service could not be reached. The message is safe to show."""


def _questions():
    return {
        cid: {
            "type": "noul",
            "instructions": (
                "Does this pathology report meet the following clinical-trial criterion? "
                f"Criterion: {text} Answer true only if the report's findings support it."
            ),
        }
        for cid, text in CRITERIA_TEXT.items()
    }


def score(text: str, timeout: float = 45) -> dict[str, float]:
    key = os.environ.get("JEV_API_KEY")
    if not key:
        raise JevUnavailable("Jev is not configured: set JEV_API_KEY when starting the analysis service.")
    body = json.dumps({"model": MODEL, "state": text, "questions": _questions()}).encode()
    req = urllib.request.Request(URL, body, {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            answers = json.load(r)["answers"]
    except urllib.error.HTTPError as e:
        raise JevUnavailable(f"Jev returned an error (HTTP {e.code}).") from None
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError):
        raise JevUnavailable("Jev could not be reached.") from None
    return {cid: float(a["noul"]) for cid, a in answers.items() if a.get("noul") is not None}
