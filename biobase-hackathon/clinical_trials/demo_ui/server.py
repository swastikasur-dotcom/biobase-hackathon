"""Local-only demo server. Run with: python -m clinical_trials.demo_ui.server"""

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from clinical_trials.cache import TTLCache
from clinical_trials.clinicaltrials_gov import ClinicalTrialsGovClient
from clinical_trials.geocoding import NominatimGeocoder
from clinical_trials.keenable_research import KeenableTrialResearchProvider
from clinical_trials.models import PatientProfile
from clinical_trials.service import build_discovery_result
from clinical_trials.task_a_adapter import profile_from_task_a_fields
from task_a.parse_reports import parse as parse_pathology_report


STATIC_DIR = Path(__file__).with_name("static")
CLIENT = ClinicalTrialsGovClient(cache=TTLCache(ttl_seconds=900))
GEOCODER = NominatimGeocoder(cache=TTLCache(ttl_seconds=30 * 24 * 60 * 60))
RESEARCH_PROVIDER = KeenableTrialResearchProvider(cache=TTLCache(ttl_seconds=60 * 60))


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


def run_search(payload):
    profile_data = dict(payload.get("profile") or {})
    location = dict(profile_data.get("location") or {})
    if location.get("query") and location.get("radius_miles") is not None:
        location.update(GEOCODER.geocode(location["query"]))
        profile_data["location"] = location
    profile = PatientProfile.from_dict(profile_data)
    page_size = int(payload.get("page_size", 10))
    include_not_matches = bool(payload.get("include_not_matches", False))
    trials = CLIENT.search_open_trials(profile, page_size=page_size)
    output = build_discovery_result(
        profile,
        trials,
        answers_by_trial=payload.get("answers_by_trial") or {},
        include_not_matches=include_not_matches,
    )
    by_id = {trial.nct_id: _trial_summary(trial) for trial in trials}
    for result in output["results"]:
        result["trial"] = by_id[result["nct_id"]]
    output["profile"] = profile.to_dict()
    return output


def run_parse_report(payload):
    report_text = payload.get("report_text")
    if not isinstance(report_text, str) or not report_text.strip():
        raise ValueError("report_text is required")
    parsed = parse_pathology_report(report_text)
    profile = profile_from_task_a_fields(parsed, patient_reference="local-demo")
    return {
        "profile": profile.to_dict(),
        "parsed_fields": {key: value for key, value in parsed.items() if not key.startswith("_")},
        "review_note": "Review and complete the extracted fields before searching. Age bands and pT/pN values do not establish exact age or overall stage.",
    }


def run_research(payload):
    return RESEARCH_PROVIDER.research(payload.get("nct_id"), title=payload.get("title"))


class DemoHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        relative = "index.html" if self.path in ("/", "") else self.path.lstrip("/")
        path = (STATIC_DIR / relative).resolve()
        if STATIC_DIR.resolve() not in path.parents or not path.is_file():
            self.send_error(404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path not in ("/api/search", "/api/parse-report", "/api/research"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/api/parse-report":
                result = run_parse_report(payload)
            elif self.path == "/api/research":
                result = run_research(payload)
            else:
                result = run_search(payload)
            self._json(200, result)
        except (ValueError, TypeError) as error:
            self._json(400, {"error": str(error)})
        except Exception as error:  # Demo boundary: show a usable error instead of dropping the request.
            service = "Keenable" if self.path == "/api/research" else "ClinicalTrials.gov"
            self._json(502, {"error": "{} request failed: {}".format(service, error)})

    def _json(self, status, value):
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        print("[demo] " + format_string % args)


def main():
    parser = argparse.ArgumentParser(description="Run the disposable clinical-trials demo UI")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), DemoHandler)
    print("Demo UI: http://{}:{}".format(args.host, args.port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
