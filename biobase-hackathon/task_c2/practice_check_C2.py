"""C2 practice check on the labelled slides (leave-one-out).

For each labelled slide (the query), rank the other labelled slides and score precision at 1, 5 and 10:
the share of the top results with the same organ group as the query.

Methods:
  cosine <model>      : plain similarity of slide fingerprints (Biobase baseline with gigapath)
  organ-aware rerank  : first the slides whose organ group matches the query's predicted organ
                        (predicted by the C1 classifier, trained without the query), by similarity; then the rest.
"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "task_c1"))
from slide_data import manifest, slide_vectors, l2, MODELS

C1_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "task_c1")
slides = manifest()
lab = [s for s in slides if not s.get("heldout") and s.get("organGroup")]
ids = [s["id"] for s in lab]
y = np.array([s["organGroup"] for s in lab])
n = len(ids)
classes = np.unique(y)
probs = np.load(os.path.join(C1_DIR, "loo_probs.npy"), allow_pickle=True).item()
P = probs[str(("gigapath", 0.1))]          # leave-one-out organ probabilities from the C1 winner
pred = classes[P.argmax(1)]


def sims(model):
    V = slide_vectors(model)
    d = len(next(iter(V.values())))
    X = l2(np.stack([V.get(i, np.zeros(d, np.float32)) for i in ids]))
    S = X @ X.T
    np.fill_diagonal(S, -np.inf)
    return S


def precision(rankings):
    out = []
    for k in (1, 5, 10):
        out.append(np.mean([(y[r[:k]] == y[q]).mean() for q, r in enumerate(rankings)]))
    return out


def plain(S):
    return [np.argsort(-S[q])[:10] for q in range(n)]


def organ_aware(S):
    rk = []
    for q in range(n):
        order = np.argsort(-S[q])
        order = order[order != q]
        same = [t for t in order if y[t] == pred[q]]   # pool slides are labelled: use their true group
        rest = [t for t in order if y[t] != pred[q]]
        rk.append(np.array((same + rest)[:10]))
    return rk


print(f"C2 practice check: {n} labelled slides, leave-one-out\n  {'P@1':>5} {'P@5':>5} {'P@10':>5}  method")
S = {m: sims(m) for m in MODELS}
for m in MODELS:
    p = precision(plain(S[m]))
    print(f"  {p[0]:5.2f} {p[1]:5.2f} {p[2]:5.2f}  cosine similarity, {m}" + ("   <- Biobase baseline" if m == "gigapath" else ""))
p = precision(organ_aware(S["gigapath"]))
print(f"  {p[0]:5.2f} {p[1]:5.2f} {p[2]:5.2f}  organ-aware rerank (C1 prediction) + gigapath similarity   <- used")
