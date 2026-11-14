# Biobase "Find the Right Patients" hackathon

Code and results for the Biobase challenge at the DNA Forge AI x Biology hackathon (14 November 2026).

| Task | What it does | Method | Practice score (baseline) |
|---|---|---|---|
| [Task A](task_a/) | Find the pathology reports that match each of 30 clinical criteria | Parse each report into fields, then one rule per criterion | Mean F1 1.000 on 9,010 training reports (keyword baseline 0.27) |
| [Task C1](task_c1/) | Predict the organ of 67 held-out whole-slide images | Logistic regression on GigaPath slide embeddings | 87.4% leave-one-out accuracy (1-NN baseline 77.9%) |
| [Task C2](task_c2/) | Return the 10 most similar slides for each held-out slide | Same-predicted-organ slides first, then by GigaPath similarity | P@10 0.83 (cosine baseline 0.45) |

Each task folder has its own `README.md` (overview and how to run) and `METHODS.md` (inclusion/exclusion criteria and step-by-step process).

## Repository layout

```
biobase-hackathon/
├── README.md            this file
├── LICENSE              MIT
├── requirements.txt     Python packages
├── data/                put the Biobase download here (not included, see data/README.md)
├── task_a/              criteria search on pathology reports
├── task_c1/             organ prediction for slides
└── task_c2/             similar-slide search
```

## Quick start

```bash
pip install -r requirements.txt
export BIOBASE_DIR=/path/to/Biobase        # or put the data in data/Biobase
cd task_a  && python3 -B criteria_rules.py && cd ..
cd task_c1 && python3 -W ignore practice_check.py && python3 -W ignore predict_heldout.py && cd ..
cd task_c2 && python3 -W ignore practice_check_C2.py && cd ..
```

Tested with Python 3.9.6, numpy 2.0.2, scikit-learn 1.6.1.

## Data

All reports are synthetic and were provided by the hackathon organizers. The data is **not** redistributed here; see [data/README.md](data/README.md).

## License

Code: [MIT](LICENSE). The hackathon data remains under the organizers' terms.
