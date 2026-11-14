"""Run TypeSafe's Jev on the Task A test reports and store every answer locally.

Inputs are only the report text and the plain-English criterion descriptions in criteria.json
(no Task A rules or parsed fields). For each report, ONE request asks all 30 criteria as independent yes/no ("noul") questions, so a report
can match several criteria. Jev returns, per criterion, the probability that the answer is yes.

Output (resumable; re-running skips reports already stored):
  jev_results/raw.jsonl     one line per report: id, model, usage, answers (raw API answers)
  jev_results/summary.csv   report_id, criterion_id, p_yes, decision (p_yes>=0.5)

The API key is read from the JEV_API_KEY environment variable and is never written to disk.
Usage: JEV_API_KEY=... python jev_run.py [--limit N] [--workers 8]
"""
import argparse, csv, json, os, sys, threading, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.join(os.environ.get("BIOBASE_DIR") or os.path.join(os.path.dirname(HERE), "data", "Biobase"), "pack_reports")
OUT = os.path.join(HERE, "jev_results")
URL = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"


def questions(criteria):
    return {
        c["id"]: {
            "type": "noul",
            "instructions": (
                "Does this pathology report meet the following clinical-trial criterion? "
                f"Criterion: {c['text']} Answer true only if the report's findings support it."
            ),
        }
        for c in criteria
    }


def call(key, report_text, qs, tries=6):
    body = json.dumps({"model": MODEL, "state": report_text, "questions": qs}).encode()
    for attempt in range(tries):
        req = urllib.request.Request(URL, body, {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:300]
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"HTTP {e.code}: {detail}") from None
        except (urllib.error.URLError, TimeoutError):
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    key = os.environ.get("JEV_API_KEY")
    if not key:
        sys.exit("Set JEV_API_KEY")

    criteria = json.load(open(os.path.join(PACK, "criteria.json")))
    reports = [json.loads(l) for l in open(os.path.join(PACK, "test.jsonl"))]
    qs = questions(criteria)
    os.makedirs(OUT, exist_ok=True)
    raw_path = os.path.join(OUT, "raw.jsonl")
    done = set()
    if os.path.exists(raw_path):
        done = {json.loads(l)["id"] for l in open(raw_path) if l.strip()}
    todo = [r for r in reports if r["id"] not in done]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(reports)} reports, {len(done)} already stored, running {len(todo)}")

    lock, n_ok, errors = threading.Lock(), 0, []
    with open(raw_path, "a") as out, ThreadPoolExecutor(args.workers) as pool:
        futs = {pool.submit(call, key, r["report_text"], qs): r["id"] for r in todo}
        for f in as_completed(futs):
            rid = futs[f]
            try:
                resp = f.result()
                row = {"id": rid, "model": resp.get("model"), "usage": resp.get("usage"), "answers": resp["answers"]}
                with lock:
                    out.write(json.dumps(row) + "\n")
                    out.flush()
                n_ok += 1
                if n_ok % 50 == 0:
                    print(f"  {n_ok}/{len(todo)}")
            except Exception as e:  # keep going; failed reports are retried on the next run
                errors.append((rid, str(e)))
    print(f"stored {n_ok}, failed {len(errors)}")
    for rid, e in errors[:5]:
        print("  failed", rid, e)

    # ---- summary.csv: one row per (report, criterion); Jev's answers only, no Task A rules involved ----
    rows = [json.loads(l) for l in open(raw_path) if l.strip()]
    with open(os.path.join(OUT, "summary.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["report_id", "criterion_id", "p_yes", "decision"])
        for r in rows:
            for c in criteria:
                a = r["answers"].get(c["id"], {})
                p = a.get("noul")
                w.writerow([r["id"], c["id"], "" if p is None else f"{p:.4f}", "" if p is None else int(p >= 0.5)])
    tok = sum((r.get("usage") or {}).get("input_tokens", 0) for r in rows)
    print(f"summary.csv written for {len(rows)} reports; input tokens used: {tok:,}")


if __name__ == "__main__":
    main()
