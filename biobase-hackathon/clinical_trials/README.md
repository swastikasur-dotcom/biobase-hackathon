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
  "biomarkers": {"ER": "negative", "PR": "negative", "HER2": "negative"},
  "location": {"query": "Palo Alto, CA", "radius_miles": 50}
}
```

The `ClinicalTrialsGovClient` sends only the disease descriptors needed to search
the official registry, plus the optional city/ZIP used to narrow registry results.
Age, sex, biomarkers, stage, and detailed pathology facts stay local. It returns
normalized `TrialRecord` objects with retrieval provenance.

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

### Clarification-answer contract

Each question is returned with a stable `question_id`, display prompt, quoted
criterion evidence, and the implications of Yes and No. The frontend can render
three buttons and post this JSON back to its own backend:

```json
{
  "NCT00000002": {
    "has_metastatic_disease": "no",
    "minimum_tumor_size": "yes",
    "treatment_naive": "unknown"
  }
}
```

Pass the object as `answers_by_trial` to `build_discovery_result()`. `yes`, `no`,
and `unknown` are intentionally UI-framework independent. Unknown leaves the
question open; Yes or No can move the study to likely relevant or not a match.

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

## Disposable local demo UI

The temporary UI is isolated in `demo_ui/`; the production frontend can replace
that folder without changing the matching package. From this repository directory:

```bash
python3 -m clinical_trials.demo_ui.server
```

Open `http://127.0.0.1:8765`. The demo can parse a pasted synthetic-format Task A
report into an editable profile or start from manually entered facts. The report
stays local; organ, histology, and an optional city/ZIP are used for the live
ClinicalTrials.gov query. When a travel radius is selected, the demo resolves the
city/ZIP and measures straight-line distance to each registry site. The UI renders
evidence, explains trials excluded by the patient profile, and posts
Yes/No/Unknown answers through the stable contract.
Stop it with `Ctrl-C`. Do not enter real identifying patient information.

The local demo uses the public OpenStreetMap Nominatim service for low-volume,
user-triggered place lookup and caches results for 30 days. It deliberately asks
for city/ZIP rather than a home address. This public endpoint is not a production
dependency: it is limited to one request per second, requires attribution and an
identifying User-Agent, prohibits autocomplete, and may withdraw access. Replace
the injected geocoder for a production deployment.

## Keenable boundary

`KeenableTrialResearchProvider` is a separate post-matching adapter. The demo's
`POST /api/research` endpoint accepts only an NCT ID and public trial title:

```json
{"nct_id": "NCT06058377", "title": "Public trial title"}
```

It runs three narrow searches for institutional recruitment contacts, scholarly
publication context, and sponsor updates; excludes ClinicalTrials.gov and low-value registry
mirror domains, then fetches at most six high-quality candidate pages. A source
is displayed only when the fetched page returns a direct NCT-specific evidence
passage. It is grouped by source type, and duplicate evidence from the same domain
is collapsed while distinct evidence remains visible. Institutional, government,
and scholarly domains are ranked first. The response records the official registry
update date, source publication date when available, and the date the evidence was
checked. The
patient profile, report, match facts, location, and clarification
answers are never sent to Keenable. Search queries and results may be retained by
Keenable under its default data policy, which is why this boundary is enforced.

The official SDK works keyless for the local demo. For deployment, set
`KEENABLE_API_KEY` only in the server environment; the SDK reads it automatically.
Never expose the key in frontend code. Dossiers are cached for one hour.

Keenable evidence may help a human investigate a shortlisted trial but never
changes its match classification. A future cross-trial comparison can consume the
same normalized source categories without coupling web research to eligibility.

## Deferred demo work

After the end-to-end frontend flow is connected, add synthetic patient profiles
covering strong matches, biomarker conflicts, stage conflicts, missing facts, and
location tradeoffs. Keenable research should remain a separate public-web panel;
its results must not change the ClinicalTrials.gov match assessment.
