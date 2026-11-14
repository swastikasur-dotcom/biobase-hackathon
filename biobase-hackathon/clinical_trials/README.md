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
  "stage": "pT2 pN1",
  "biomarkers": {"ER": "negative", "PR": "negative", "HER2": "negative"}
}
```

The `ClinicalTrialsGovClient` sends only the disease descriptors needed to search
the official registry. It returns normalized `TrialRecord` objects. `assess()`
returns evidence, known structured exclusions (only age/sex), and outstanding
requirements. It never determines final eligibility.

## Integration points

1. The current Task A can use `profile_from_task_a_fields(parsed_fields)`; a
   replacement task only needs to emit the same `PatientProfile` JSON.
2. The frontend sends that profile to its own backend endpoint.
3. The backend calls `search_open_trials(profile)` and `assess(profile, trial)`.
4. The UI renders the assessment plus `official_url` and the unmodified official
   eligibility text for coordinator review.

The module has no framework or third-party dependencies. It can be retained if
the frontend uses Python, wrapped in an API route, or reimplemented in another
language from this contract.

## Safety

This is pre-screening support only. A `possible_candidate` means no available
structured age/sex fact contradicted the study record; it does not mean eligible.
Trial status and eligibility are fetched from ClinicalTrials.gov and should be
refreshed/cached by the application layer.
