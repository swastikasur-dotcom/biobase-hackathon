# Veritome: the Trial Readiness Check

Check the patients before the trial, not after the rejection.

Veritome reads pathology reports and tissue slides against a clinical trial's eligibility criteria, so patient
problems show up before enrolment. It is built on the Biobase hackathon data (DNA Forge AI x Biology, 14 November 2026)
and is a research prototype. Not for clinical use.

## What it does

| Page | What you can do |
|---|---|
| **Home** | The idea in one page: why a pathology read decides trial entry, and the three checks. |
| **Find patients** (`/patients`) | Browse the cohort of reports that meet each of 30 trial criteria, filter them, and see how sure Jev is about each match. The **For a clinical trial** tab takes an NCT number or ClinicalTrials.gov link and ranks the 979 test reports by how well they fit that trial. |
| **Analyse a report** (`/patients/analyze`) | Paste or upload a pathology report. The Task A rules and Jev both score it against the 30 criteria, side by side. |
| **Find trials** (`/patients/match`) | Turn one report into a de-identified patient profile, then search ClinicalTrials.gov live. Each open trial gets evidence, exclusions and Yes/No questions where a person must decide. Optional public-source research uses Keenable. |
| **Explore slides** and **Slide map** | Browse 263 whole-slide images, see each held-out slide's predicted organ and confidence, find the 10 most similar slides, and filter a map of all slides by organ, supplier, stain or prediction. |
| **About the models / About the data** | Modals that explain how each task works and what the data can and cannot tell you. |

## The three tasks

| Task | Method | Practice result |
|---|---|---|
| **A**: match reports to 30 criteria | Parse each report into fields, then one rule per criterion. Jev (TypeSafe's System One model) gives a second, probabilistic opinion. | Mean F1 1.000 on 9,010 training reports |
| **C1**: organ of a slide | Logistic regression on GigaPath slide embeddings | 87.4% leave-one-out accuracy (nearest-slide baseline 77.9%) |
| **C2**: similar slides | Slides in the predicted organ first, then ordered by GigaPath similarity | Precision@10 0.83 (plain similarity 0.45) |

Task code and methods are in `biobase-hackathon/task_a`, `task_c1` and `task_c2`, each with its own README and `METHODS.md`.

### Submission files

| Task | File |
|---|---|
| A | `biobase-hackathon/task_a/submission_criteria.json` |
| C1 | `biobase-hackathon/task_c1/submission_slides_organ.csv` |
| C2 | `biobase-hackathon/task_c2/submission_slides_similar.csv` |

## Repository layout

```
.
├── backend/              FastAPI service: report analysis, Jev, trial search and matching
├── frontend/             React app (Vite, TypeScript, Tailwind), tests and data export script
├── biobase-hackathon/    task code, METHODS, submission files and the clinical_trials package
├── presentation/         the Trial Readiness Check deck
├── pack_reports/  pack_slides/  tilepack/  tiles20x/  thumbnails/
│                         hackathon data (not in git, see "Data" below)
└── biobase_paperclip_datasets_v3/   literature images and biomarkers used by the slide pages
```

## Run it locally

You need Python 3.9 or newer and Node 20 or newer.

### 1. Data

The Biobase data is not redistributed. Download the hackathon packs and put them in the repo root, so these folders sit
next to `backend/` and `frontend/`:

`pack_reports/`, `pack_slides/`, `tilepack/`, `tiles20x/`, `thumbnails/`

If the data lives elsewhere, set `BIOBASE_DIR=/path/to/Biobase` for the backend and the export script.

The frontend serves thumbnails, tiles and the literature images through symlinks. Create them once:

```bash
cd frontend/public
ln -s ../../thumbnails thumbnails
ln -s ../../tiles20x tiles20x
ln -s ../../biobase_paperclip_datasets_v3 paperclip
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Optional: for Jev scores on the Analyse a report page, set a Jev key when you start the backend (step 4). Without it the
page still shows the rule results and says Jev is not configured. The key is read from the environment and never stored.

### 3. Frontend

```bash
cd frontend
npm install
npm run export-data      # builds frontend/public/data/*.json from the data packs (needed once)
```

### 4. Start both servers

In one terminal, the API (port 8000):

```bash
cd frontend
JEV_API_KEY=your-key npm run api      # drop JEV_API_KEY=... to run without Jev
```

In another, the app:

```bash
cd frontend
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). The dev server proxies `/api` to port 8000.
The API does not reload on its own: restart it after you change anything in `backend/`.

Find trials, trial-to-patient matching and public sources call ClinicalTrials.gov (and OpenStreetMap for distances), so
they need an internet connection.

### Tests and checks

```bash
cd frontend
npm run typecheck      # TypeScript
npm run lint           # oxlint
npm test               # unit tests (vitest)
npm run e2e            # Playwright browser tests (starts the app and the API)

cd ../backend
.venv/bin/python -m pytest -q
```

### Re-run the task code

```bash
cd biobase-hackathon
pip install -r requirements.txt
export BIOBASE_DIR=/path/to/Biobase
cd task_a  && python3 -B criteria_rules.py
cd ../task_c1 && python3 -W ignore practice_check.py && python3 -W ignore predict_heldout.py
cd ../task_c2 && python3 -W ignore practice_check_C2.py
```

Jev scores for all 979 test reports are stored in `biobase-hackathon/task_a/jev_results/`. To regenerate them:
`JEV_API_KEY=your-key python3 task_a/jev_run.py`.

## Push your work to main

The repository is `github.com/swastikasur-dotcom/biobase-hackathon`. Day-to-day work happens on a branch, and `main` receives
it once the checks pass.

```bash
# 1. See what changed, then run the checks
git status
cd frontend && npm run typecheck && npm run lint && npm test && npm run e2e
cd ../backend && .venv/bin/python -m pytest -q && cd ..

# 2. Commit on your branch (for example `interface`)
git add -A
git commit -m "Describe what changed and why"

# 3. Push the branch
git push origin interface

# 4. Merge into main and push it
git checkout main
git pull --ff-only origin main        # get anyone else's changes first
git merge interface                   # resolve any conflicts, then commit
git push origin main
git checkout interface                # go back to your branch
```

Things to know:

- **Authentication:** GitHub no longer accepts a password for `git push`. Sign in once with `gh auth login`, or use a
  personal access token as the password. Do this if you see "Invalid username or token".
- **First push of a new branch:** use `git push -u origin <branch>` so later pushes need no arguments.
- **Conflicts:** if `git merge` stops with conflicts, open the files git lists, keep the right lines, remove the `<<<<<<<`
  markers, then `git add` the files and `git commit`.
- **Pull requests:** to have someone review before `main` changes, push the branch and open a pull request on GitHub instead
  of merging locally.
- **Secrets:** never commit an API key. `JEV_API_KEY` is read from the environment only.
- **Data stays out of git:** the data packs, `frontend/public/data/` and `node_modules/` are ignored on purpose. A teammate
  rebuilds the JSON with `npm run export-data`.

## Notes and limits

- Reports are synthetic and describe no real patient. Reports and slides come from separate datasets and cannot be linked.
- Trial matching is first-pass pre-screening. It reads only a few requirements (age, sex, histology, ER/PR/HER2, stage,
  tumour size, metastatic status, prior treatment) and leaves the rest as official text for a person to read. Ages are the
  middle of each report's age band.
- Uploading a slide is a demo: the organ model needs precomputed GigaPath embeddings, so an uploaded file is not analysed.
- Accuracy figures are from labelled practice data. The test reports and slides have no public answer key.

## Other work in this repository

- **KIT / GIST compound triage** (`kittriage/`, `build/`, `tests/`): a separate project added by a collaborator. It has nothing to do
  with the Veritome app; its own README is [KITTRIAGE.md](KITTRIAGE.md).

## Licence

MIT, see `LICENSE`.
