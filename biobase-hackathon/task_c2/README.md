# Task C2 — Find the 10 most similar slides

**Goal:** for each of the 67 held-out slides, return the 10 most similar slides in the collection.

**Score:** precision at k (P@1, P@5, P@10): the share of returned slides in the same organ group as the query.

## Method in brief

- **Organ-aware ranking:** slides in the query's **predicted organ group** (from Task C1) come first, ordered by GigaPath cosine similarity; all other slides follow, also by similarity. The top 10 are returned.
- Candidate slides use their true organ group if labelled, or their C1 prediction if held out. A slide is never returned as its own match.
- Checked with a leave-one-out practice check on the 190 labelled slides, using C1 predictions made without the query slide.

Inclusion/exclusion criteria and the step-by-step process: [METHODS.md](METHODS.md).

## Results (leave-one-out, 190 slides)

| Method | P@1 | P@5 | P@10 |
|---|---|---|---|
| GigaPath cosine similarity (Biobase baseline) | 0.78 | 0.56 | 0.45 |
| **Organ-aware ranking + GigaPath (used)** | **0.87** | **0.85** | **0.83** |

All methods: [practice_results_C2.txt](practice_results_C2.txt).

**Limitation:** results depend on C1. If C1 predicts the wrong organ for a query, most of its 10 results will be in the wrong group.

## Files

| File | What it is |
|---|---|
| `practice_check_C2.py` | Leave-one-out practice check (needs `../task_c1/loo_probs.npy`). |
| `submission_slides_similar.csv` | Submission: `query_slide_id, rank, result_slide_id`, 67 × 10 rows. Written by `../task_c1/predict_heldout.py`. |
| `practice_results_C2.txt` | Practice-check results table. |
| `METHODS.md` | Methods section. |

## How to run

From the repository root, with the data in place (see [../data/README.md](../data/README.md)):

```bash
pip install -r requirements.txt
cd task_c1 && python3 -W ignore practice_check.py && cd ..   # creates loo_probs.npy (~9 min)
cd task_c2 && python3 -W ignore practice_check_C2.py          # C2 practice check
cd ../task_c1 && python3 -W ignore predict_heldout.py         # writes ../task_c2/submission_slides_similar.csv
```
