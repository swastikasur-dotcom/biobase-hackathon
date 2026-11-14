"""Task A: one rule per criterion, on top of parse_reports.parse().

Usage:
  python3 criteria_rules.py            # score every rule on train, write test submission
  python3 criteria_rules.py c05 c08    # also print mismatched train reports for these criteria
"""
import json, os, re, sys
from parse_reports import parse, DATA

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- helpers on a parsed report p ----------

def f(p, key):
    return (p.get(key) or "").lower()

def pos_nodes(p):
    """Number of positive lymph nodes, or None if no nodes examined."""
    m = re.search(r"(\d+)\s+of\s+(\d+)\s+positive", f(p, "Lymph nodes"))
    return int(m.group(1)) if m else None

def size_mm(p):
    m = re.search(r"([\d.]+)\s*(mm|cm)", f(p, "Tumor size"))
    if not m:
        return None
    v = float(m.group(1))
    return v * 10 if m.group(2) == "cm" else v

def stage(p):
    s = p.get("Pathologic stage (AJCC 8th ed.)") or ""
    t = re.search(r"\b(y?p?T\w+)", s)
    n = re.search(r"\b(y?p?N\w+)", s)
    return (t.group(1) if t else ""), (n.group(1) if n else "")

def age_low(p):
    a = p.get("age_band", "")
    return 90 if a.startswith("90") else int(a.split("-")[0])

def present(p, key):
    return f(p, key).startswith("present")

def not_identified(p, key):
    return f(p, key).startswith("not identified")

def biomarker(p, name):
    """'positive' / 'negative' / 'equivocal' / None for ER, PR or HER2 in breast Biomarkers."""
    m = re.search(rf"\b{name}\s+(positive|negative|equivocal|low)", f(p, "Biomarkers"))
    return m.group(1) if m else None

def closest_margin_mm(p):
    m = re.search(r"invasive carcinoma is ([\d.]+)\s*mm from the closest margin", f(p, "Margins"))
    return float(m.group(1)) if m else None

# ---------- the 30 rules ----------

def is_(p, organ):
    return p["organ"] == organ

RULES = {
    "c01": lambda p: is_(p, "breast") and biomarker(p, "her2") == "negative" and (pos_nodes(p) or 0) >= 1,
    "c02": lambda p: is_(p, "breast") and biomarker(p, "er") == "positive" and biomarker(p, "pr") == "negative",
    "c03": lambda p: is_(p, "breast") and biomarker(p, "er") == "negative" and biomarker(p, "pr") == "negative"
                     and biomarker(p, "her2") == "negative",
    "c04": lambda p: is_(p, "breast") and present(p, "Lymphovascular invasion") and (size_mm(p) or 0) > 20,
    "c05": lambda p: is_(p, "breast") and f(p, "Margins").startswith("negative")
                     and (closest_margin_mm(p) is not None and closest_margin_mm(p) <= 3),
    "c06": lambda p: is_(p, "breast") and f(p, "Tumor focality").startswith("multifocal") and age_low(p) < 60,
    "c07": lambda p: is_(p, "breast") and f(p, "Nottingham grade").startswith("3")
                     and not_identified(p, "Lymphovascular invasion"),
    # Stage III = any pN1/pN2, including pN1c (tumor deposits with 0 positive nodes).
    "c08": lambda p: is_(p, "colon") and re.match(r"y?pN[12]", stage(p)[1]) is not None,
    "c09": lambda p: is_(p, "colon") and f(p, "Histologic type").startswith("mucinous"),
    "c10": lambda p: is_(p, "colon") and present(p, "Tumor deposits"),
    "c11": lambda p: is_(p, "colon") and pos_nodes(p) == 0 and present(p, "Lymphovascular invasion"),
    "c12": lambda p: is_(p, "colon") and stage(p)[0].lstrip("y").startswith("pT4"),
    "c13": lambda p: is_(p, "colon") and (size_mm(p) or 0) >= 50 and not_identified(p, "Perineural invasion"),
    "c14": lambda p: is_(p, "lung") and present(p, "Visceral pleural invasion"),
    "c15": lambda p: is_(p, "lung") and "squamous" in f(p, "Histologic type")
                     and re.search(r"bronchial margin (positive|involved)", f(p, "Margins")) is not None,
    "c16": lambda p: is_(p, "lung") and "adenocarcinoma" in f(p, "Histologic type") and (pos_nodes(p) or 0) >= 1,
    "c17": lambda p: is_(p, "prostate") and re.search(r"grade group [45]", f(p, "Gleason score")) is not None,
    "c18": lambda p: is_(p, "prostate") and present(p, "Seminal vesicle invasion"),
    "c19": lambda p: is_(p, "prostate") and f(p, "Margins").startswith("positive")
                     and not_identified(p, "Extraprostatic extension"),
    "c20": lambda p: is_(p, "prostate") and present(p, "Perineural invasion")
                     and not_identified(p, "Lymphovascular invasion"),
    "c21": lambda p: is_(p, "stomach") and f(p, "HER2").startswith("positive"),
    "c22": lambda p: is_(p, "stomach") and f(p, "Histologic type").startswith("poorly cohesive")
                     and (pos_nodes(p) or 0) >= 1,
    "c23": lambda p: is_(p, "stomach") and stage(p)[0].lstrip("y").startswith("pT4"),
    "c24": lambda p: is_(p, "kidney") and "clear cell" in f(p, "Histologic type") and f(p, "ISUP grade")[:1] in ("3", "4"),
    "c25": lambda p: is_(p, "kidney") and present(p, "Sarcomatoid or rhabdoid features"),
    "c26": lambda p: is_(p, "kidney") and re.search(r"renal vein|vena cava", f(p, "Extent of invasion")) is not None,
    "c27": lambda p: is_(p, "skin") and f(p, "Diagnosis").startswith("basal cell carcinoma")
                     and re.search(r"extends to the (peripheral and )?deep margin|deep margins? involved",
                                   f(p, "Margins")) is not None,
    "c28": lambda p: is_(p, "skin") and f(p, "Diagnosis").startswith("invasive squamous cell carcinoma")
                     and re.search(r"\(g[23]\)", f(p, "Diagnosis")) is not None,
    "c29": lambda p: is_(p, "colon") and (pos_nodes(p) or 0) >= 1 and age_low(p) >= 70,
    "c30": lambda p: is_(p, "lung") and p.get("sex") == "F" and p.get("report_year") in (2023, 2024),
}


def run(path):
    reports = [json.loads(l) for l in open(path)]
    parsed = [(r["id"], parse(r["report_text"])) for r in reports]
    return {cid: [rid for rid, p in parsed if rule(p)] for cid, rule in RULES.items()}, dict(parsed), reports


def f1(pred, gold):
    pred, gold = set(pred), set(gold)
    tp = len(pred & gold)
    if not pred and not gold:
        return 1.0, 1.0, 1.0
    prec = tp / len(pred) if pred else 0.0
    rec = tp / len(gold) if gold else 0.0
    return prec, rec, (2 * prec * rec / (prec + rec) if prec + rec else 0.0)


if __name__ == "__main__":
    show = set(sys.argv[1:])
    crit = {c["id"]: c["text"] for c in json.load(open(os.path.join(DATA, "criteria.json")))}
    gold = json.load(open(os.path.join(DATA, "criteria_train_answers.json")))
    pred, parsed, _ = run(os.path.join(DATA, "train.jsonl"))

    print(f"{'id':4} {'pred':>5} {'gold':>5} {'prec':>5} {'rec':>5} {'F1':>5}  criterion")
    scores = []
    for cid in RULES:
        p, r, s = f1(pred[cid], gold[cid])
        scores.append(s)
        flag = "" if s == 1 else "  <--"
        print(f"{cid:4} {len(pred[cid]):5d} {len(gold[cid]):5d} {p:5.3f} {r:5.3f} {s:5.3f}  {crit[cid][:70]}{flag}")
        if cid in show:
            for label, ids in (("FALSE POSITIVE", set(pred[cid]) - set(gold[cid])),
                               ("MISSED", set(gold[cid]) - set(pred[cid]))):
                for rid in list(ids)[:4]:
                    print(f"   {label} {rid}\n{parsed[rid]['_block'][:700]}\n")
    print(f"\nMean train F1: {sum(scores) / len(scores):.3f}")

    test_pred, _, _ = run(os.path.join(DATA, "test.jsonl"))
    out = os.path.join(HERE, "submission_criteria.json")
    json.dump(test_pred, open(out, "w"), indent=1)
    print(f"Wrote {out}: " + ", ".join(f"{k}={len(v)}" for k, v in test_pred.items()))
