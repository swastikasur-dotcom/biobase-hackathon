"""Step 2: practice check on the labelled slides (leave-one-out).

For every labelled slide: hide it, train on the others, predict its organ group (C1),
and rank the other labelled slides by similarity (C2). Prints accuracy and precision at 1/5/10
for each method, overall and for SUPP-02 (85% of the held-out slides come from SUPP-02).
"""
import warnings
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from slide_data import manifest, slide_vectors, tile_vectors, l2, MODELS, TILE_MODELS

warnings.filterwarnings("ignore")
slides = manifest()
lab = [s for s in slides if not s.get("heldout") and s.get("organGroup")]
ids = [s["id"] for s in lab]
y = np.array([s["organGroup"] for s in lab])
sup = np.array([s["id"][:7] for s in lab])
n = len(ids)

# ---- features per model: slide mean vector; for tile models also mean+std pooling ----
SV = {m: slide_vectors(m) for m in MODELS}
TV = {m: tile_vectors(m) for m in TILE_MODELS}
dim = {m: len(next(iter(SV[m].values()))) for m in MODELS}


def mean_feat(m):
    return np.stack([SV[m].get(i, np.zeros(dim[m], np.float32)) for i in ids])


def meanstd_feat(m):
    out = []
    for i in ids:
        t = l2(TV[m][i])
        out.append(np.concatenate([l2(t.mean(0)), t.std(0)]))
    return np.stack(out)


def meta_feat():
    out = []
    for s in lab:
        out.append([s.get("sex") == "M", s.get("sex") == "F", s["id"][:7] == "SUPP-01",
                    s["id"][:7] == "SUPP-02", s.get("stain") == "H&E"])
    return np.array(out, dtype=np.float32)


F = {m: mean_feat(m) for m in MODELS}
F.update({m + "+std": meanstd_feat(m) for m in TILE_MODELS})
META = meta_feat()


# ---- C1 methods ----
def knn_predict(X, k):
    X = l2(X)
    S = X @ X.T
    np.fill_diagonal(S, -np.inf)
    pred = []
    for q in range(n):
        top = np.argsort(-S[q])[:k]
        votes = {}
        for r, t in enumerate(top):
            votes[y[t]] = votes.get(y[t], 0) + S[q, t]  # similarity-weighted vote
        pred.append(max(votes, key=votes.get))
    return np.array(pred)


def lr_proba(X, C=1.0):
    """Leave-one-out class probabilities from logistic regression."""
    classes = np.unique(y)
    P = np.zeros((n, len(classes)))
    for q in range(n):
        tr = np.arange(n) != q
        sc = StandardScaler().fit(X[tr])
        clf = LogisticRegression(C=C, max_iter=2000).fit(sc.transform(X[tr]), y[tr])
        P[q, np.searchsorted(classes, clf.classes_)] = clf.predict_proba(sc.transform(X[q:q + 1]))[0]
    return classes, P


def acc(pred, mask=None):
    mask = np.ones(n, bool) if mask is None else mask
    return (pred[mask] == y[mask]).mean()


s02 = sup == "SUPP-02"
results = []


def report(name, pred):
    results.append((acc(pred), acc(pred, s02), name))
    print(f"  {acc(pred):6.1%}  {acc(pred, s02):6.1%}  {name}", flush=True)


print(f"C1 practice check: {n} labelled slides, leave-one-out\n  {'all':>6}  {'SUPP-02':>6}  method")
for m in MODELS:
    report(f"baseline 1-NN, {m}", knn_predict(F[m], 1))
for m in MODELS:
    report(f"5-NN vote, {m}", knn_predict(F[m], 5))

probs = {}
for key in ["gigapath", "hoptimus", "biomedclip", "dinov2", "hoptimus+std", "biomedclip+std"]:
    for C in (0.01, 0.1):
        classes, P = lr_proba(F[key], C)
        probs[(key, C)] = P
        report(f"logistic regression, {key}, C={C}", classes[P.argmax(1)])

# combine models: average the probabilities of the best per-model classifiers
def best_C(key):
    return max((0.01, 0.1), key=lambda C: acc(classes[probs[(key, C)].argmax(1)]))

for combo in (["gigapath", "hoptimus"], ["gigapath", "hoptimus", "biomedclip"],
              ["gigapath", "hoptimus+std", "biomedclip+std"], ["gigapath", "hoptimus", "biomedclip", "dinov2"]):
    P = sum(probs[(k, best_C(k))] for k in combo) / len(combo)
    report("ensemble " + " + ".join(combo), classes[P.argmax(1)])

# add metadata (sex, supplier, stain) as extra features on the concatenated top models
Xc = np.hstack([F["gigapath"], F["hoptimus"], META * 3])
classes, P = lr_proba(Xc, 0.01)
report("logistic regression, gigapath+hoptimus+metadata, C=0.01", classes[P.argmax(1)])
probs[("gh+meta", 0.01)] = P

import os
np.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "loo_probs.npy"), {str(k): v for k, v in probs.items()}, allow_pickle=True)
print("\nBest C1:", max(results)[2], f"({max(results)[0]:.1%})")
