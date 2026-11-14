"""Domain-shift experiments for C1 on the precomputed GigaPath slide embeddings.

Compares the current head (standardize + logistic regression) with variants that deal with
supplier/stain shift: per-supplier centering, fitting the scaler on all slides (incl. held-out),
and self-training on unlabelled slides. Scored with repeated stratified 5-fold CV, plus a
cross-supplier stress test (train on one supplier, test on another).

Run: BIOBASE_DIR=~/Downloads/Biobase python domain_shift.py
"""
import warnings
import numpy as np
from collections import Counter
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.preprocessing import StandardScaler
from slide_data import manifest, slide_vectors

warnings.filterwarnings("ignore")
slides = [s for s in manifest() if s["id"] in (V := slide_vectors("gigapath"))]
ids = [s["id"] for s in slides]
X_all = np.stack([V[i] for i in ids]).astype(np.float64)
sup = np.array([s["supplierId"] for s in slides])
held = np.array([bool(s.get("heldout")) for s in slides])
organ = np.array([s.get("organGroup") or "" for s in slides])
lab = ~held & (organ != "")
print(f"{len(slides)} slides with GigaPath vector; {lab.sum()} labelled; {held.sum()} held-out")
print("labelled by supplier:", dict(Counter(sup[lab])), "| held-out by supplier:", dict(Counter(sup[held])))


def center(X, min_n=30):
    """Subtract each supplier's mean embedding (computed over ALL slides of that supplier,
    labelled + held-out). Suppliers with fewer than min_n slides are left alone: too few to estimate a mean."""
    X = X.copy()
    for s in np.unique(sup):
        m = sup == s
        if m.sum() >= min_n:
            X[m] -= X[m].mean(0)
    return X


def fit_predict(Xtr, ytr, Xte, C=0.1, scaler_fit=None, unl=None, self_train=0):
    sc = StandardScaler().fit(Xtr if scaler_fit is None else scaler_fit)
    clf = LogisticRegression(C=C, max_iter=3000).fit(sc.transform(Xtr), ytr)
    if self_train and unl is not None:
        for _ in range(self_train):
            p = clf.predict_proba(sc.transform(unl))
            keep = p.max(1) >= 0.6
            if not keep.any():
                break
            Xa = np.vstack([Xtr, unl[keep]])
            ya = np.concatenate([ytr, clf.classes_[p.argmax(1)][keep]])
            clf = LogisticRegression(C=C, max_iter=3000).fit(sc.transform(Xa), ya)
    return clf.predict(sc.transform(Xte)), clf


def variants():
    Xc = center(X_all)
    return {
        "baseline: scaler(train) + LR C=0.1": dict(X=X_all),
        "scaler fit on all 263 slides": dict(X=X_all, scaler="all"),
        "per-supplier centering": dict(X=Xc),
        "per-supplier centering + scaler on all": dict(X=Xc, scaler="all"),
        "self-training (unlabelled = held-out + test fold)": dict(X=X_all, scaler="all", st=2),
        "centering + self-training": dict(X=Xc, scaler="all", st=2),
    }


# ---- 1. repeated stratified CV on the labelled slides ----
idx = np.where(lab)[0]
y = organ[idx]
# classes with <5 members cannot be stratified 5 ways: fold sizes degrade gracefully, warning suppressed
cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=6, random_state=0)
res = {k: [] for k in variants()}
res_s02 = {k: [] for k in variants()}
for tr, te in cv.split(idx, y):
    tr_i, te_i = idx[tr], idx[te]
    for name, v in variants().items():
        X = v["X"]
        unl_i = np.concatenate([np.where(held)[0], te_i])
        pred, _ = fit_predict(X[tr_i], organ[tr_i], X[te_i], scaler_fit=X if v.get("scaler") == "all" else None,
                              unl=X[unl_i] if v.get("st") else None, self_train=v.get("st", 0))
        ok = pred == organ[te_i]
        res[name].append(ok.mean())
        if (sup[te_i] == "SUPP-02").any():
            res_s02[name].append(ok[sup[te_i] == "SUPP-02"].mean())

print("\n== Repeated stratified 5-fold CV (6 repeats = 30 folds), accuracy ==")
print(f"{'all slides':>16} {'SUPP-02 only':>14}  method")
for k in res:
    a, b = np.array(res[k]), np.array(res_s02[k])
    print(f"{a.mean()*100:6.1f}% ±{a.std()/np.sqrt(len(a))*100:3.1f} {b.mean()*100:8.1f}% ±{b.std()/np.sqrt(len(b))*100:3.1f}  {k}")

# ---- 2. cross-supplier stress test ----
print("\n== Cross-supplier: train on one supplier's labelled slides, test on another's ==")
for tr_s, te_s in [("SUPP-02", "SUPP-01"), ("SUPP-01", "SUPP-02")]:
    tr_i = np.where(lab & (sup == tr_s))[0]
    te_i = np.where(lab & (sup == te_s))[0]
    shared = set(organ[tr_i]) & set(organ[te_i])
    te_i = np.array([i for i in te_i if organ[i] in shared])  # only organs seen in training
    print(f"train {tr_s} ({len(tr_i)}) -> test {te_s} ({len(te_i)}, organs seen in training)")
    for name, v in variants().items():
        if v.get("st"):
            continue
        X = v["X"]
        pred, _ = fit_predict(X[tr_i], organ[tr_i], X[te_i], scaler_fit=X if v.get("scaler") == "all" else None)
        print(f"  {(pred == organ[te_i]).mean()*100:5.1f}%  {name}")
