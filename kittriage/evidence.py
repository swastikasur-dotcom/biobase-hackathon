"""Local DepMap analysis and exact, tri-state plasma-panel membership."""
import csv
import math
from statistics import mean
from pathlib import Path
from .io import utcnow


def pearson(pairs):
    if len(pairs) < 3:
        return None
    xs, ys = zip(*pairs)
    mx, my = mean(xs), mean(ys)
    dx, dy = [x-mx for x in xs], [y-my for y in ys]
    denominator = math.sqrt(sum(x*x for x in dx) * sum(y*y for y in dy))
    return sum(x*y for x, y in zip(dx, dy)) / denominator if denominator else None


def codependencies(csv_path, target='KIT', min_pairs=30, limit=20, model_ids=None):
    """Input: model IDs in column 1, gene effects in columns named SYMBOL or SYMBOL (Entrez)."""
    if min_pairs < 3:
        raise ValueError('At least three paired models are required')
    with open(csv_path, newline='', encoding='utf-8-sig') as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        candidates = [f for f in fields[1:] if f.split(' (')[0] == target]
        if len(candidates) != 1:
            raise ValueError('Exactly one target gene column required')
        target_column = candidates[0]
        pairs = {f: [] for f in fields[1:] if f != target_column}
        seen = set()
        for row in reader:
            model = row[fields[0]]
            if model in seen:
                raise ValueError('Duplicate DepMap model ID: ' + model)
            seen.add(model)
            if model_ids is not None and model not in model_ids:
                continue
            try:
                x = float(row[target_column])
            except (ValueError, TypeError):
                continue
            if not math.isfinite(x):
                continue
            for gene in pairs:
                try:
                    y = float(row[gene])
                except (ValueError, TypeError):
                    continue
                if math.isfinite(y):
                    pairs[gene].append((x, y))
    results = []
    for gene, observations in pairs.items():
        if len(observations) < min_pairs:
            continue
        correlation = pearson(observations)
        if correlation is not None:
            results.append({'gene': gene, 'pearson_r': correlation, 'n_pairs': len(observations)})
    results.sort(key=lambda r: r['pearson_r'], reverse=True)
    return {'status': 'computed', 'target': target, 'results': results[:limit],
            'cohort': 'explicit model subset' if model_ids is not None else 'all provided models',
            'input_file': Path(csv_path).name, 'retrieved_at': utcnow(),
            'interpretation': 'Exploratory co-dependency, not synthetic lethality or a validated combination. Pan-lineage correlations can be confounded by lineage.'}


def panel_membership(csv_path, accession='P10721', complete=False):
    with open(csv_path, newline='', encoding='utf-8-sig') as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        column = next((f for f in fields if f.lower().replace('_', '') in {'uniprot', 'uniprotid', 'uniprotaccession'}), None)
        if column is None:
            raise ValueError('Assay table needs a UniProt identifier column')
        rows = list(reader)
        if not rows:
            raise ValueError('Assay membership table is empty')
        matches = [r for r in rows if accession in {v.strip() for v in r[column].replace(';', ',').split(',')}]
    return {'status': 'present' if matches else ('absent' if complete else 'unknown'),
            'accession': accession, 'matches': matches, 'table_rows': len(rows),
            'complete_table_asserted': complete, 'input_file': Path(csv_path).name,
            'interpretation': 'Plasma-panel membership is not a disease association and does not establish somatic KIT mutation effects.'}
