# Task C1 — Predict the organ of a slide

**Goal:** predict the organ group (one of 15, e.g. Breast, Colon and rectum, Lung) of each of 67 held-out whole-slide images, using the 196 labelled slides for training.

**Score:** accuracy.

## Method in brief

- Each slide is represented by its precomputed **GigaPath** slide embedding (1,536 numbers).
- A **logistic-regression** classifier (features standardized, C = 0.1) is trained on the labelled slides and predicts the organ of each held-out slide.
- The method was chosen with a **leave-one-out practice check** on the 190 labelled slides with an organ: hide one slide, train on the rest, predict it, repeat. 25 variants were compared (4 embedding models, nearest-neighbour, voting, logistic regression, ensembles, metadata).

Inclusion/exclusion criteria and the step-by-step process: [METHODS.md](METHODS.md).

## Results (leave-one-out, 190 slides)

| Method | Accuracy | SUPP-02 only |
|---|---|---|
| 1-nearest neighbour, GigaPath (Biobase baseline) | 77.9% | 78.9% |
| **Logistic regression, GigaPath, C = 0.1 (used)** | **87.4%** | **89.1%** |

All 25 variants: [practice_results_C1.txt](practice_results_C1.txt).

13 of the 67 held-out predictions have confidence below 0.5 (see `heldout_predictions_with_confidence.csv`).

## Files

| File | What it is |
|---|---|
| `slide_data.py` | Loads the slide manifest and the slide/tile embeddings. |
| `practice_check.py` | Leave-one-out comparison of all methods (~9 min). Saves `loo_probs.npy`, used by Task C2. |
| `predict_heldout.py` | Trains the final model; writes the C1 submission **and** the C2 submission (`../task_c2/`). |
| `submission_slides_organ.csv` | Submission: `slide_id, organ` for the 67 held-out slides. |
| `heldout_predictions_with_confidence.csv` | Same predictions with confidence, least confident first. |
| `practice_results_C1.txt` | Practice-check results table. |
| `METHODS.md` | Methods section. |

## How to run

From the repository root, with the data in place (see [../data/README.md](../data/README.md)):

```bash
pip install -r requirements.txt
cd task_c1
python3 -W ignore practice_check.py     # optional: practice check (~9 min)
python3 -W ignore predict_heldout.py    # final predictions for C1 and C2
```

`-W ignore` hides harmless numpy floating-point warnings that appear on some Macs.
