# Task A — Find the right patients (criteria search)

**Goal:** for each of 30 plain-English criteria (e.g. *"Triple-negative breast cancer"*, *"Colon cancer with positive lymph nodes (stage III)"*), list every one of the 979 test pathology reports that matches.

**Score:** mean F1 over the 30 criteria.

## Method in brief

1. `parse_reports.py` turns each report into structured fields (organ, sex, age band, report year, and every FINAL DIAGNOSIS field such as *Lymph nodes*, *Margins*, *Biomarkers*). It handles both report layouts (one field per line, or `; `-separated).
2. `criteria_rules.py` has one rule per criterion, written on those fields.
3. The rules were checked against the 9,010 labelled training reports (F1 = 1.000 on all 30) and then applied unchanged to the 979 test reports.

Full inclusion/exclusion criteria for every rule and the step-by-step process: [METHODS.md](METHODS.md).

## Results

| | |
|---|---|
| Training mean F1 | **1.000** (keyword baseline 0.27) |
| Blind spot check on test | 40 reports × 30 criteria, 1,200 / 1,200 agreements |
| Matches per criterion (test) | 6 to 77 |

## Files

| File | What it is |
|---|---|
| `parse_reports.py` | Report parser. Run it directly to check it against the training labels. |
| `criteria_rules.py` | The 30 rules. Prints training precision/recall/F1 and writes the submission. |
| `field_keys.json` | List of field names used by the parser (built from the training labels). |
| `submission_criteria.json` | Submission: `{criterion_id: [report_id, ...]}` for the 979 test reports. |
| `METHODS.md` | Methods section. |

## How to run

From the repository root, with the data in place (see [../data/README.md](../data/README.md)):

```bash
cd task_a
python3 parse_reports.py              # parser check against training labels
python3 -B criteria_rules.py          # score on training + write submission_criteria.json
python3 -B criteria_rules.py c08 c27  # also show mismatches for chosen criteria
```

Standard library only; no packages needed.
