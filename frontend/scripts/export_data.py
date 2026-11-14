"""Export the Task A / C1 / C2 outputs as static JSON for the frontend.

Usage (from anywhere; the backend venv has numpy and scikit-learn for the 2D map):
  backend/.venv/bin/python frontend/scripts/export_data.py

Reads the Biobase data folders in the repo root (pack_reports, pack_slides,
tilepack, tiles20x) and the committed task code in biobase-hackathon/, and
writes JSON into frontend/public/data/. Nothing outside that folder is written.
Override the data folder with BIOBASE_DIR.
"""
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.dirname(HERE)
REPO = os.path.dirname(FRONTEND)
BIOBASE = os.environ.get("BIOBASE_DIR") or REPO
os.environ["BIOBASE_DIR"] = BIOBASE  # parse_reports reads this at import time

CODE = os.path.join(REPO, "biobase-hackathon")
TASK_A = os.path.join(CODE, "task_a")
TASK_C1 = os.path.join(CODE, "task_c1")
TASK_C2 = os.path.join(CODE, "task_c2")
OUT = os.path.join(FRONTEND, "public", "data")

sys.path.insert(0, TASK_A)
from criteria_rules import run  # noqa: E402  (reuses the Task A rules as-is)


def write(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w") as fh:
        json.dump(obj, fh, separators=(",", ":"))
    print(f"wrote {name:16} {os.path.getsize(path) / 1024:9.1f} KiB")


def read_csv(path):
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh))


def export_task_a():
    pack = os.path.join(BIOBASE, "pack_reports")
    criteria = json.load(open(os.path.join(pack, "criteria.json")))
    # Cohorts come from running the real rules on the test reports.
    cohorts, parsed, reports = run(os.path.join(pack, "test.jsonl"))

    # Cross-check against the committed submission file.
    submitted = json.load(open(os.path.join(TASK_A, "submission_criteria.json")))
    for cid, ids in cohorts.items():
        if sorted(ids) != sorted(submitted[cid]):
            raise SystemExit(f"{cid}: rules output differs from submission_criteria.json")

    matched_by = {}
    for cid, ids in cohorts.items():
        for rid in ids:
            matched_by.setdefault(rid, []).append(cid)

    out_reports = []
    for r in reports:
        fields = {k: v for k, v in parsed[r["id"]].items() if not k.startswith("_")}
        out_reports.append({
            "id": r["id"],
            "text": r["report_text"],
            "fields": fields,
            "matches": sorted(matched_by.get(r["id"], [])),
        })

    write("criteria.json", criteria)
    write("cohorts.json", cohorts)
    write("reports.json", out_reports)


def export_slides():
    manifest = json.load(open(os.path.join(BIOBASE, "pack_slides", "slides_manifest.json")))

    # C1: the confidence file is the only source of per-slide confidence.
    preds = {}
    for row in read_csv(os.path.join(TASK_C1, "heldout_predictions_with_confidence.csv")):
        preds[row["slide_id"]] = {
            "organ": row["predicted_organ_group"],
            "confidence": float(row["confidence"]),
        }
    submitted = {r["slide_id"]: r["organ"] for r in read_csv(os.path.join(TASK_C1, "submission_slides_organ.csv"))}
    for sid, organ in submitted.items():
        if preds[sid]["organ"] != organ:
            raise SystemExit(f"{sid}: C1 confidence file and submission disagree")

    slides = []
    for s in manifest["slides"]:
        item = {
            "id": s["id"],
            "supplierId": s.get("supplierId"),
            "stain": s.get("stain"),
            "magnification": s.get("magnification"),
            "width": s.get("width"),
            "height": s.get("height"),
            "sex": s.get("sex"),
            "ageBucket": s.get("ageBucket"),
            "heldout": bool(s.get("heldout")),
            "organGroup": s.get("organGroup"),  # absent for held-out slides
            "organ": s.get("organ"),
            "diagnosis": s.get("diagnosis"),
            "stage": s.get("stage"),
            "report": s.get("report"),  # only 57 slides have one
            "prediction": preds.get(s["id"]),
        }
        slides.append({k: v for k, v in item.items() if v is not None})

    # C2: ranks only, no similarity scores.
    similar = {}
    for row in read_csv(os.path.join(TASK_C2, "submission_slides_similar.csv")):
        similar.setdefault(row["query_slide_id"], []).append((int(row["rank"]), row["result_slide_id"]))
    similar = {q: [sid for _, sid in sorted(v)] for q, v in similar.items()}

    write("slides.json", {"organGroups": manifest["organGroupList"], "slides": slides})
    write("similar.json", similar)
    return slides, preds, similar


def gigapath_points():
    """2D t-SNE of the GigaPath slide embeddings, the ones C1 and C2 use, so that slides near each
    other on the map are slides the similarity ranking sees as close. Deterministic (fixed seed)."""
    import numpy as np
    from sklearn.manifold import TSNE

    rows = json.load(open(os.path.join(BIOBASE, "tilepack", "embeddings", "gigapath", "slide-vectors.json")))
    ids = [r["id"] for r in rows]
    x = np.array([r["v"] for r in rows], dtype=np.float64)
    x /= np.linalg.norm(x, axis=1, keepdims=True)
    y = TSNE(n_components=2, perplexity=30, metric="cosine", init="pca", random_state=0).fit_transform(x)
    y = (y - y.min(axis=0)) / (y.max(axis=0) - y.min(axis=0))
    return [{"id": i, "x": round(float(a), 4), "y": round(float(b), 4)} for i, (a, b) in zip(ids, y)]


def export_umap():
    """Writes umap.json (the name is historical: it holds whichever 2D map is used)."""
    try:
        write("umap.json", {"model": "gigapath", "method": "t-SNE", "points": gigapath_points()})
        return
    except ImportError:
        print("numpy/scikit-learn not installed: falling back to the precomputed DINOv2 map")
    base = os.path.join(BIOBASE, "tilepack", "embeddings")
    for model in ("dinov2", "hoptimus", "biomedclip"):
        path = os.path.join(base, model, "points.json")
        if os.path.exists(path):
            data = json.load(open(path))
            write("umap.json", {"model": model, "method": data.get("method", "UMAP"), "points": data["points"]})
            return
    print("no 2D map available; skipping umap.json")


def export_paperclip():
    """Paperclip literature search results (dataset v3): H&E micrographs, biomarker findings and a Biobase
    slide profile, grouped by the 15 Biobase organ groups. Skipped when the dataset folder is absent."""
    root = os.environ.get("PAPERCLIP_DIR") or os.path.join(BIOBASE, "biobase_paperclip_datasets_v3")
    if not os.path.isdir(root):
        print(f"no Paperclip dataset at {root}; skipping paperclip.json")
        return

    def rows(name):
        with open(os.path.join(root, name), newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))

    def num(v):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None

    organs = {}

    def organ(name):
        return organs.setdefault(name, {"micrographs": [], "biomarkers": [], "profile": None})

    for r in rows("he_tumour_micrographs.csv"):
        organ(r["organ_group"])["micrographs"].append({
            "id": os.path.splitext(os.path.basename(r["image_file"]))[0],
            "image": r["image_file"],  # relative to the dataset folder
            "diagnosis": r["diagnosis"], "site": r["organ_site"], "grade": r["grade"], "stage": r["stage"],
            "stain": r["stain"], "magnification": num(r["approx_total_magnification"]),
            "specimen": r["specimen_type"], "features": r["key_features"], "caption": r["figure_caption"],
            "study": r["study"], "title": r["title"], "year": num(r["year"]), "journal": r["journal"],
            "link": r["link"], "pmcid": r["pmcid"], "qc": r["qc_flags"], "qcNote": r["qc_note"],
        })
    for r in rows("tumour_biomarkers.csv"):
        organ(r["organ_group"])["biomarkers"].append({
            "tumour": r["tumour_type"], "biomarker": r["biomarker"], "direction": r["direction_vs_normal"],
            "method": r["method"], "value": r["percent_positive_or_fold_change"],
            "association": r["association_with_stage_or_grade"], "comparator": r["comparator"],
            "use": r["diagnostic_or_prognostic_use"], "quote": r["evidence_quote"], "study": r["study"],
            "title": r["title"], "year": num(r["year"]), "journal": r["journal"], "link": r["link"],
            "note": r["reviewer_note"],
        })
    for r in rows("biobase_slide_profile_by_organ.csv"):
        organ(r["organ_group"])["profile"] = {
            "slides": num(r["n_labelled_slides"]), "diagnoses": r["diagnoses"], "stages": r["stages"],
            "stains": r["stains"], "markers": r["reported_markers"], "magnification": r["magnification"],
        }

    write("paperclip.json", {
        "dataset": "Paperclip literature datasets v3 (after independent review, 14 Nov 2026)",
        "organs": organs,
    })
    print("paperclip:", sum(len(o["micrographs"]) for o in organs.values()), "micrographs,",
          sum(len(o["biomarkers"]) for o in organs.values()), "biomarker findings")


def export_tiles():
    root = os.path.join(BIOBASE, "tiles20x")
    blank = {(r["slide_id"], r["file"]) for r in read_csv(os.path.join(root, "blank_tiles.csv"))}
    tiles = {}
    for sid in sorted(os.listdir(root)):
        d = os.path.join(root, sid)
        if not os.path.isdir(d):
            continue
        items = []
        for fn in sorted(os.listdir(d)):
            stem, ext = os.path.splitext(fn)
            if ext.lower() != ".jpg" or (sid, fn) in blank or (sid, f"{sid}/{fn}") in blank:
                continue
            col, row = stem.split("_")
            items.append([int(col), int(row)])
        tiles[sid] = items
    write("tiles.json", tiles)
    return tiles


def main():
    os.makedirs(OUT, exist_ok=True)
    export_task_a()
    slides, preds, similar = export_slides()
    export_umap()
    export_paperclip()
    tiles = export_tiles()

    print("\ncounts:",
          f"slides={len(slides)}",
          f"heldout_predictions={len(preds)}",
          f"similar_queries={len(similar)}",
          f"similar_rows={sum(len(v) for v in similar.values())}",
          f"slides_with_tiles={sum(1 for v in tiles.values() if v)}")


if __name__ == "__main__":
    main()
