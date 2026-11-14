# Task C2 — Methods: finding the 10 most similar slides

## Data

- The same 263 slides, organ groups and model fingerprints as Task C1.
- The organ predictions for the 67 held-out slides from Task C1.
- Scoring: precision at k (P@1, P@5, P@10), the share of the top k results that are in the same organ group as the query slide.

## Inclusion and exclusion criteria

**Query slides**

- Practice check: the 190 labelled slides with an organ group.
- Final submission: all 67 held-out slides. None were excluded.

**Candidate (result) slides**

- Practice check: the other 189 labelled slides with an organ group.
- Final submission: all 263 slides in the manifest (labelled and held-out).
- The query slide itself is always excluded from its own results.
- Each query gets exactly 10 results, ranked 1 to 10.

**Organ group used for matching**

- Labelled candidate slides: their true organ group.
- Held-out candidate slides: their organ group predicted in Task C1.
- Query slides: the organ group predicted in Task C1. In the practice check, the prediction comes from a classifier trained without the query.
- Slides with no organ group (6) never count as a same-organ match, so they can only appear after all same-organ slides.

## Step-by-step process

- Loaded the slide fingerprints of all four models, scaled to unit length.
- Computed the cosine similarity between every pair of slides.
- Set up a leave-one-out practice check: each labelled slide is the query once, and the other 189 labelled slides are the candidates.
- Scored the Biobase baseline: rank candidates by GigaPath cosine similarity alone.
- Scored the same plain similarity ranking for H-optimus, BiomedCLIP and DINOv2.
- Took each query's predicted organ from the C1 practice check (the classifier trained without that slide).
- Scored an organ-aware ranking: candidates in the query's predicted organ group come first, ordered by GigaPath similarity, then all others by similarity.
- Picked the organ-aware ranking: P@1/5/10 of 0.87 / 0.85 / 0.83, against 0.78 / 0.56 / 0.45 for the baseline.
- For the final run, gave every candidate slide an organ group: true group for labelled slides, C1 prediction for held-out slides.
- For each of the 67 held-out slides, ranked all other slides with the organ-aware ranking and kept the top 10.
- Wrote `submission_slides_similar.csv` (query_slide_id, rank, result_slide_id), 670 rows.
- Checked the file against the template: 67 queries × 10 ranks, ranks 1–10, all result IDs valid, no slide returned as its own match.

## Results

| Method | P@1 | P@5 | P@10 |
|---|---|---|---|
| GigaPath cosine similarity (Biobase baseline) | 0.78 | 0.56 | 0.45 |
| H-optimus cosine similarity | 0.58 | 0.40 | 0.31 |
| BiomedCLIP cosine similarity | 0.58 | 0.43 | 0.34 |
| DINOv2 cosine similarity | 0.56 | 0.34 | 0.27 |
| **Organ-aware ranking + GigaPath similarity (used)** | **0.87** | **0.85** | **0.83** |

- Limitation: the ranking depends on the C1 prediction. When C1 predicts the wrong organ for a query, most of its 10 results will be in the wrong group.

## Reproducibility

- Code: `practice_check_C2.py` (practice check; uses `../task_c1/loo_probs.npy`). The final submission is written by `../task_c1/predict_heldout.py`.
- Full practice results: `practice_results_C2.txt`.
- Rerun with: `cd task_c2 && python3 -W ignore practice_check_C2.py` (from the repository root)
- Software: Python 3.9.6, numpy 2.0.2, scikit-learn 1.6.1.
