"""Load the slide manifest and the embeddings from the Biobase download (read only)."""
import json, os
import numpy as np

# Folder with the Biobase hackathon download (pack_reports, pack_slides, tilepack, ...).
# Set the BIOBASE_DIR environment variable, or put the download in <repo>/data/Biobase.
BIOBASE = os.environ.get("BIOBASE_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "Biobase")
EMB = os.path.join(BIOBASE, "tilepack", "embeddings")
MODELS = ["gigapath", "hoptimus", "biomedclip", "dinov2"]
TILE_MODELS = ["hoptimus", "biomedclip", "dinov2"]  # gigapath has slide vectors only


def manifest():
    return json.load(open(os.path.join(BIOBASE, "pack_slides", "slides_manifest.json")))["slides"]


def l2(x):
    n = np.linalg.norm(x, axis=-1, keepdims=True)
    return x / np.where(n == 0, 1, n)


def slide_vectors(model):
    """{slide_id: unit vector} from the model's slide-vectors.json."""
    rows = json.load(open(os.path.join(EMB, model, "slide-vectors.json")))
    return {r["id"]: l2(np.asarray(r["v"], dtype=np.float32)) for r in rows}


def tile_vectors(model):
    """{slide_id: (n_tiles, dim) array of tile vectors} for a model that has tile files."""
    meta = json.load(open(os.path.join(EMB, model, "tile-meta.json")))
    v = np.fromfile(os.path.join(EMB, model, "tile-vectors.i8"), dtype=np.int8)
    v = v.reshape(meta["tiles"], meta["dim"]).astype(np.float32) / meta["scale"]
    return {sid: v[s["offset"]: s["offset"] + s["count"]] for sid, s in meta["slides"].items()}
