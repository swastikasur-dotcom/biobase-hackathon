"""Parse synthetic pathology reports into structured fields.

parse(report_text) -> dict with keys:
  sex, age_band, report_year, specimen, organ (guessed), and every
  FINAL DIAGNOSIS field (e.g. "Lymph nodes", "Margins", "Biomarkers").
Works for both layouts: one field per line, or all fields on one line split by "; ".
"""
import json, re, os

HERE = os.path.dirname(os.path.abspath(__file__))  # results folder: scripts and outputs
# Folder with the Biobase hackathon download (pack_reports, pack_slides, tilepack, ...).
# Set the BIOBASE_DIR environment variable, or put the download in <repo>/data/Biobase.
BIOBASE = os.environ.get("BIOBASE_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "Biobase")
DATA = os.path.join(BIOBASE, "pack_reports")  # only read, never written

# Every field name that appears in the train labels (built once, cached in a file).
KEYS_FILE = os.path.join(HERE, "field_keys.json")


def _load_keys():
    if os.path.exists(KEYS_FILE):
        return json.load(open(KEYS_FILE))
    keys = set()
    for line in open(os.path.join(DATA, "train.jsonl")):
        keys.update(json.loads(line)["labels"]["diagnosis"].keys())
    keys = sorted(keys, key=len, reverse=True)
    json.dump(keys, open(KEYS_FILE, "w"), indent=1)
    return keys


KEYS = [k for k in _load_keys() if k not in ("Specimen", "Diagnosis")]
KEY_RE = re.compile(
    r"(?:^|\n|;\s|\.\s|FINAL DIAGNOSIS:\s)\s*(" + "|".join(re.escape(k) for k in KEYS) + r"):\s*"
)

ORGAN_WORDS = [
    ("skin", r"\bskin\b"),
    ("breast", r"\bbreast\b"),
    ("lung", r"\blung\b|\blobe\b|\bbronch"),
    ("prostate", r"\bprostat"),
    ("stomach", r"\bstomach\b|\bgastr"),
    ("colon", r"\bcolon\b|\bcolectomy\b|\bcecum\b|\bsigmoid\b|\brect"),
    ("kidney", r"\bkidney\b|\bnephrectomy\b|\brenal\b"),
]


def guess_organ(specimen):
    # The organ named earliest in the specimen line wins
    # ("Colon ..., colectomy with en bloc resection of stomach" -> colon).
    s = specimen.lower()
    hits = [(m.start(), organ) for organ, pat in ORGAN_WORDS for m in [re.search(pat, s)] if m]
    return min(hits)[1] if hits else None


def parse(text):
    out = {}
    m = re.search(r"Patient:\s*([MF]),\s*age band\s*([0-9+\-]+)\s*\|\s*Report year:\s*(\d{4})", text)
    if m:
        out["sex"], out["age_band"], out["report_year"] = m.group(1), m.group(2), int(m.group(3))
    m = re.search(r"SPECIMEN:\s*(.*)", text)
    out["specimen"] = m.group(1).strip() if m else ""
    out["organ"] = guess_organ(out["specimen"])

    start = text.find("FINAL DIAGNOSIS:")
    end = text.find("GROSS DESCRIPTION:", start)
    block = text[start:end].rstrip()
    out["_block"] = block

    matches = list(KEY_RE.finditer(block))
    # text before the first key (skin reports put the diagnosis here)
    head_end = matches[0].start() if matches else len(block)
    head = block[len("FINAL DIAGNOSIS:"):head_end].strip().strip(";").strip()
    if head:
        out["Diagnosis"] = head.rstrip(".")
    for i, mm in enumerate(matches):
        val_end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
        val = block[mm.end():val_end].strip()
        val = re.sub(r"[;.\s]+$", "", val)
        out[mm.group(1)] = val
    return out


if __name__ == "__main__":
    # Check the parser against the train labels.
    from collections import Counter
    bad, total, miss_keys = Counter(), 0, Counter()
    examples = {}
    for line in open(os.path.join(DATA, "train.jsonl")):
        r = json.loads(line)
        p = parse(r["report_text"])
        lab = r["labels"]
        total += 1
        if p["organ"] != lab["organ"]:
            bad["organ"] += 1
            examples.setdefault("organ", (p["specimen"], lab["organ"]))
        for k, v in lab["diagnosis"].items():
            if k in ("Specimen", "Diagnosis"):
                continue
            got = p.get(k)
            if got is None:
                miss_keys[k] += 1
            elif got.rstrip(".") != v.rstrip("."):
                bad[k] += 1
                examples.setdefault(k, (got, v))
    print("reports:", total)
    print("organ / value mismatches:", dict(bad))
    print("missing keys:", dict(miss_keys))
    for k, (g, v) in list(examples.items())[:10]:
        print(f"\n[{k}]\n got: {g!r}\nwant: {v!r}")
