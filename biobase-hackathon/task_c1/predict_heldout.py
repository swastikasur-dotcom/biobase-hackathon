"""Final run for C1 and C2 on the 67 held-out slides.

C1: logistic regression (C=0.1) on GigaPath slide fingerprints, trained on all 190 labelled slides.
    -> task_c1/submission_slides_organ.csv
C2: for each held-out slide, the other slides whose organ group matches its predicted organ come first
    (labelled slides by their true group, held-out slides by their predicted group), ordered by GigaPath
    similarity; then the rest by similarity. Top 10.
    -> task_c2/submission_slides_similar.csv
"""
import csv, os
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from slide_data import manifest, slide_vectors

HERE = os.path.dirname(os.path.abspath(__file__))
C2_DIR = os.path.join(HERE, "..", "task_c2")

slides = manifest()
V = slide_vectors("gigapath")
lab = [s for s in slides if not s.get("heldout") and s.get("organGroup") and s["id"] in V]
held = [s["id"] for s in slides if s.get("heldout")]
assert all(h in V for h in held), "every held-out slide needs a GigaPath vector"

# ---- C1 ----
X = np.stack([V[s["id"]] for s in lab]).astype(np.float64)
y = np.array([s["organGroup"] for s in lab])
sc = StandardScaler().fit(X)
clf = LogisticRegression(C=0.1, max_iter=5000).fit(sc.transform(X), y)
H = np.stack([V[h] for h in held]).astype(np.float64)
proba = clf.predict_proba(sc.transform(H))
pred = dict(zip(held, clf.classes_[proba.argmax(1)]))
conf = dict(zip(held, proba.max(1)))

with open(os.path.join(HERE, "submission_slides_organ.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["slide_id", "organ"])
    for h in held:
        w.writerow([h, pred[h]])
with open(os.path.join(HERE, "heldout_predictions_with_confidence.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["slide_id", "predicted_organ_group", "confidence"])
    for h in sorted(held, key=lambda h: conf[h]):
        w.writerow([h, pred[h], f"{conf[h]:.2f}"])

# ---- C2 ----
group = {s["id"]: s.get("organGroup") for s in slides if not s.get("heldout")}
group.update(pred)                       # held-out slides: predicted group
pool = [s["id"] for s in slides]
dim = len(next(iter(V.values())))
P = np.stack([V.get(i, np.zeros(dim, np.float32)) for i in pool]).astype(np.float64)

rows = []
for h in held:
    s = P @ V[h].astype(np.float64)
    order = [pool[j] for j in np.argsort(-s) if pool[j] != h]
    same = [t for t in order if group.get(t) == pred[h]]
    rest = [t for t in order if group.get(t) != pred[h]]
    for rank, t in enumerate((same + rest)[:10], 1):
        rows.append([h, rank, t])

with open(os.path.join(C2_DIR, "submission_slides_similar.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["query_slide_id", "rank", "result_slide_id"])
    w.writerows(rows)

from collections import Counter
print("C1 predicted organ groups:", dict(Counter(pred.values()).most_common()))
print("C1 low-confidence (<0.5):", sum(c < 0.5 for c in conf.values()), "of", len(held))
print("C2 rows:", len(rows))
