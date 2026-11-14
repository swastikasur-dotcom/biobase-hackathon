"""Local-only demo server. Run with: python -m clinical_trials.demo_ui.server"""

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from clinical_trials.cache import TTLCache
from clinical_trials.clinicaltrials_gov import ClinicalTrialsGovClient
from clinical_trials.models import PatientProfile
from clinical_trials.service import build_discovery_result


STATIC_DIR = Path(__file__).with_name("static")
CLIENT = ClinicalTrialsGovClient(cache=TTLCache(ttl_seconds=900))


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
    profile = PatientProfile.from_dict(payload.get("profile") or {})
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
        if self.path != "/api/search":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._json(200, run_search(payload))
        except (ValueError, TypeError) as error:
            self._json(400, {"error": str(error)})
        except Exception as error:  # Demo boundary: show a usable error instead of dropping the request.
            self._json(502, {"error": "ClinicalTrials.gov request failed: {}".format(error)})

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
