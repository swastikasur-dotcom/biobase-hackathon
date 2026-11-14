# Data (not included)

The Biobase hackathon data is not part of this repository. To run the code:

1. Download the hackathon materials (`pack_reports`, `pack_slides`, `tilepack`).
2. Put them in `data/Biobase/`, so you have `data/Biobase/pack_reports/train.jsonl`, `data/Biobase/pack_slides/slides_manifest.json`, `data/Biobase/tilepack/embeddings/...`

   Or leave them anywhere and point to them:

   ```bash
   export BIOBASE_DIR=/path/to/Biobase
   ```

`data/Biobase/` is listed in `.gitignore`, so it is never uploaded by accident.
