# ClinicalTrials.gov first layer

This module is a framework-independent, conservative clinical-trial *discovery*
layer. It is deliberately separate from Task A/C1/C2 so a frontend or a revised
model implementation can integrate through small JSON contracts rather than
imports into challenge scripts.

## Boundary

`PatientProfile` is the only input contract. It contains de-identified, extracted
facts—not the pathology report itself and never a patient name or MRN.

```json
{
  "patient_reference": "case-42",
  "primary_organ": "breast",
  "age_years": 47,
  "sex": "female",
  "histology": "invasive ductal carcinoma",
  "stage": "Stage II",
  "metastatic_status": "non_metastatic",
  "tumor_size_mm": 24,
  "treatment_naive": true,
  "biomarkers": {"ER": "negative", "PR": "negative", "HER2": "negative"}
}
```

The `ClinicalTrialsGovClient` sends only the disease descriptors needed to search
the official registry. Age, sex, biomarkers, stage, location, and pathology facts
stay local. It returns normalized `TrialRecord` objects with retrieval provenance.

`assess()` conservatively recognizes organ, histology, ER/PR/HER2, overall stage,
metastatic status, minimum tumor size, and treatment-naive requirements. A fact it
cannot establish becomes a yes/no clarification question that includes the effect
of each answer. It never determines final eligibility.

`build_discovery_result()` is the frontend-facing shape. It returns likely-relevant
and needs-more-information trials by default and collapses known mismatches into a
count. Pass `include_not_matches=True` for an audit/expanded view.

## Integration points

1. The current Task A can use `profile_from_task_a_fields(parsed_fields)`; a
   replacement task only needs to emit the same `PatientProfile` JSON.
2. The frontend sends that profile to its own backend endpoint.
3. The backend calls `search_open_trials(profile)` and
   `build_discovery_result(profile, trials, answers_by_trial)`.
4. The UI renders evidence and clarification questions. Submitting yes/no/unknown
   answers and rebuilding the result immediately reclassifies the trial.
5. The UI links to `official_url` and retains the unmodified official eligibility
   text for coordinator review.

The module has no framework or third-party dependencies. It can be retained if
the frontend uses Python, wrapped in an API route, or reimplemented in another
language from this contract.

## Safety

This is pre-screening support only. `likely_relevant` means the small set of
recognized facts does not contradict the record; it does not mean eligible. Every
result retains the official URL, registry retrieval time, and study update date.

An in-memory TTL cache is available in `cache.TTLCache`. Production deployments
can replace it with a shared cache without changing the client contract.

## Verification

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s clinical_trials/tests -v
```

## Deferred demo work

After the end-to-end frontend flow is connected, add synthetic patient profiles
covering strong matches, biomarker conflicts, stage conflicts, missing facts, and
location tradeoffs. Keenable should then be added as a separate public-web research
panel; its results must not change the ClinicalTrials.gov match assessment.
