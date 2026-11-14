# Task A — Methods: rule-based patient selection from pathology reports

## Data

- Training set: 9,010 synthetic pathology reports with labelled fields and the correct patient list for each criterion (`train.jsonl`, `criteria_train_answers.json`).
- Test set: 979 unlabelled synthetic pathology reports (`test.jsonl`).
- Criteria: 30 plain-English selection criteria (`criteria.json`), c01–c30.
- All 979 test reports were processed; no report was dropped.

## Inclusion and exclusion criteria

General rules that apply to every criterion:

- **Organ:** a report is eligible only if its specimen line names the criterion's organ. When several organs are named, the one mentioned first is used ("Colon …, en bloc resection of stomach" counts as colon).
- **"Present"** means the field starts with "present". **"Not identified"** means the field starts with "not identified". A missing field meets neither.
- **Positive lymph nodes** come from "X of Y positive". A report with no nodes examined has an unknown count, so it fails every node-positive and every node-negative criterion.
- **Tumor size** is converted to mm (cm × 10). A missing size fails every size criterion.
- **Age** is given only as a band (e.g. "65-69"), so the band's lower bound is used. "90+" counts as 90.
- **Stage** is read from the AJCC 8th edition line. Post-treatment stages (ypT, ypN) count the same as pT and pN.

| ID | Include if (all must hold) | Exclude if |
|---|---|---|
| c01 | Breast; HER2 negative; ≥1 positive node | HER2 positive, equivocal, low or missing; 0 positive nodes; no nodes examined |
| c02 | Breast; ER positive; PR negative | ER not positive; PR not negative; either marker missing |
| c03 | Breast; ER, PR and HER2 all negative | Any of the three not negative (positive, equivocal, low or missing) |
| c04 | Breast; LVI present; tumor > 20 mm | LVI not present; tumor ≤ 20 mm (exactly 20 mm excluded); size missing |
| c05 | Breast; margins negative; invasive carcinoma ≤ 3 mm from the closest margin | Margins positive; distance > 3 mm; distance not stated |
| c06 | Breast; multifocal; age band starts below 60 | Unifocal or focality missing; age band 60-64 or older |
| c07 | Breast; Nottingham grade 3; LVI not identified | Grade 1 or 2; LVI present or missing |
| c08 | Colon; stage pN1 or pN2 (includes pN1c: tumor deposits with 0 positive nodes) | pN0 or pNX |
| c09 | Colon; histologic type starts with "mucinous" | Any other type |
| c10 | Colon; tumor deposits present | Deposits not identified or missing |
| c11 | Colon; nodes examined with 0 positive; LVI present | ≥1 positive node; no nodes examined; LVI not present |
| c12 | Colon; stage pT4 (pT4a or pT4b) | pT1–pT3 |
| c13 | Colon; tumor ≥ 50 mm; perineural invasion not identified | Tumor < 50 mm or size missing; PNI present or missing |
| c14 | Lung; visceral pleural invasion present | VPI not identified or missing |
| c15 | Lung; squamous cell type; bronchial margin positive or involved | Other type; bronchial margin negative |
| c16 | Lung; adenocarcinoma; ≥1 positive node | Other type; 0 positive nodes; no nodes examined |
| c17 | Prostate; Grade Group 4 or 5 | Grade Group 1–3 |
| c18 | Prostate; seminal vesicle invasion present | SVI not identified or missing |
| c19 | Prostate; margin positive; extraprostatic extension not identified | Margin negative; EPE present or missing |
| c20 | Prostate; perineural invasion present; LVI not identified | PNI not present; LVI present or missing |
| c21 | Stomach; HER2 positive | HER2 negative, equivocal or missing |
| c22 | Stomach; type starts with "poorly cohesive" (pure diffuse); ≥1 positive node | Mixed or other types; 0 positive nodes; no nodes examined |
| c23 | Stomach; stage pT4 (pT4a or pT4b) | pT1–pT3 |
| c24 | Kidney; clear cell RCC; ISUP grade 3 or 4 | Other subtypes; ISUP 1–2 |
| c25 | Kidney; sarcomatoid or rhabdoid features present | Not identified or missing |
| c26 | Kidney; extent of invasion names the renal vein or vena cava | No venous extension mentioned |
| c27 | Skin; diagnosis basal cell carcinoma; tumor extends to the deep margin ("extends to the deep margin", "extends to the peripheral and deep margin" or "deep margin involved") | Other diagnoses; only the peripheral margin involved; margins clear |
| c28 | Skin; invasive squamous cell carcinoma; grade G2 or G3 | In-situ SCC; well differentiated (G1); other diagnoses |
| c29 | Colon; ≥1 positive node; age band starts at 70 or above | 0 positive nodes; no nodes examined; age band 65-69 or younger |
| c30 | Lung; female; report year 2023 or 2024 | Male; any other report year |

## Step-by-step process

- Read the 30 criteria and paired each one with the report fields it depends on.
- Collected every field name used in the training labels (e.g. "Lymph nodes", "Margins", "Biomarkers") into a reference list (`field_keys.json`).
- Read the patient line of each report to get sex, age band and report year.
- Read the SPECIMEN line and assigned the organ from the first organ word it contains.
- Extracted the FINAL DIAGNOSIS block, from "FINAL DIAGNOSIS:" up to "GROSS DESCRIPTION:".
- Split the block into fields by name. This handles both report layouts: one field per line, and all fields on one line separated by "; ".
- Stored the text before the first field as the "Diagnosis" (used for skin reports).
- Checked the parser against the 9,010 training labels: every organ and field value matched.
- Wrote helper functions for positive node count, tumor size in mm, pT/pN stage, age band lower bound, present / not identified, ER/PR/HER2 status, and closest margin distance.
- Wrote one rule per criterion (30 rules), each combining the organ check with that criterion's conditions.
- Ran the 30 rules on the training reports and compared the results with the training answers (precision, recall, F1 per criterion).
- Inspected the mismatched reports and corrected two rules: c08 (added pN1c, stage III with 0 positive nodes) and c27 (added the wording "deep margin involved").
- Re-ran on training: F1 = 1.000 for all 30 criteria (Biobase keyword baseline: 0.27).
- Applied the same parser and rules, unchanged, to the 979 test reports.
- Sanity-checked the test results: every report parsed, no new field wording beyond lymph-node station lists, and match rates close to the training rates.
- Ran a blind spot check: an independent reviewer judged 40 test reports against all 30 criteria without seeing our answers, and agreed on 1,200 of 1,200 decisions.
- Wrote the submission file `submission_criteria.json`, listing the matching report IDs for each criterion (between 6 and 77 reports per criterion).
- Wrote readable versions of the test reports with their matched criteria (`test_reports_readable.txt`, `test_reports_table.csv`) for manual review.

## Reproducibility

- Code: `parse_reports.py` (parser) and `criteria_rules.py` (30 rules, training score, test submission).
- Rerun with: `cd task_a && python3 -B criteria_rules.py` (from the repository root)
- Software: Python 3.9.6, standard library only (json, re).
