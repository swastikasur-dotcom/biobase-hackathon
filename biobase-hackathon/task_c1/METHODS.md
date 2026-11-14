# Task C1 — Methods: predicting the organ of held-out slides

## Data

- Slide manifest: 263 whole-slide images (`slides_manifest.json`). 196 are labelled with an organ and 67 are held out. Slides are H&E 233, IHC 22, special stains 8.
- Organ groups: 15 groups (`organ_groups.json`), e.g. Breast, Colon and rectum, Lung, Other or mixed.
- Slide fingerprints (embeddings) from four pretrained pathology/vision models: GigaPath (1536 numbers per slide), H-optimus (1536), BiomedCLIP (512) and DINOv2 (384).
- Tile-level fingerprints for H-optimus, BiomedCLIP and DINOv2 (`tile-vectors.i8`). GigaPath provides slide-level vectors only.
- Held-out slides by supplier: SUPP-02 57, SUPP-01 8, SUPP-03 2.

## Inclusion and exclusion criteria

**Training and practice check (labelled slides)**

- Included: labelled (not held-out) slides with an organ group. 190 slides.
- Excluded: 6 labelled slides with no organ group (nothing to learn from or score against).
- Practice check: the 2 included slides with no GigaPath vector (SUPP-03-bb_03_wsi_0004 and _0005) stayed in and were given an all-zero vector, so every method was scored on the same 190 slides.
- Final model: trained on the 188 labelled slides that have a GigaPath vector; the 2 slides without one were left out.

**Prediction (held-out slides)**

- Included: all 67 held-out slides. All have a GigaPath vector. None were excluded.

**Allowed labels**

- Each prediction is exactly one of the 15 official organ groups.

## Step-by-step process

- Loaded the slide manifest and the organ group list.
- Loaded the slide fingerprints of all four models and scaled each to unit length.
- Decoded the tile fingerprints: int8 values divided by 127.
- Built extra features from the tiles: the mean and the spread (standard deviation) of each slide's tile fingerprints.
- Set up a leave-one-out practice check: hide one labelled slide, train on the other 189, predict the hidden slide, and repeat for all 190.
- Reported accuracy on all 190 slides and on the SUPP-02 slides separately, because 57 of the 67 held-out slides are from SUPP-02.
- Scored the Biobase baseline: copy the organ of the single most similar slide (1-nearest neighbour, cosine similarity) for each model.
- Scored a similarity-weighted vote of the 5 most similar slides for each model.
- Scored a logistic-regression classifier for each model and feature set: features standardized, strength of regularization C = 0.01 or 0.1.
- Scored ensembles that average the classifier probabilities of 2, 3 or 4 models.
- Scored a classifier that adds metadata (sex, supplier, stain) to the GigaPath and H-optimus fingerprints.
- Picked the best method: logistic regression on GigaPath fingerprints with C = 0.1, at 87.4% accuracy (89.1% on SUPP-02), against 77.9% for the baseline.
- Recorded that combining models or adding metadata scored lower (77–85%).
- Trained the chosen classifier on the 188 labelled slides with a GigaPath vector.
- Predicted the organ group of each of the 67 held-out slides and recorded the classifier's confidence (highest probability).
- Wrote `submission_slides_organ.csv` (slide_id, organ), in the same order as the official template.
- Checked the file against the template: 67 rows, same slide IDs and order, every label a valid organ group.
- Wrote `heldout_predictions_with_confidence.csv`, sorted least confident first. 13 of 67 predictions are below 0.5 confidence.

## Results

- Practice accuracy: 87.4% (baseline 77.9%).
- Held-out predictions: Colon and rectum 12, Breast 10, Prostate 7, Stomach 6, Lung 6, Thyroid 6, Uterus 5, Bladder 5, Kidney 4, Liver 4, Other or mixed 1, Skin 1.

## Reproducibility

- Code: `slide_data.py` (loading), `practice_check.py` (leave-one-out comparison, about 9 minutes), `predict_heldout.py` (final model and both submissions).
- Full practice results: `practice_results_C1.txt`.
- Rerun with: `cd task_c1 && python3 -W ignore predict_heldout.py` (from the repository root)
- Software: Python 3.9.6, numpy 2.0.2, scikit-learn 1.6.1.
