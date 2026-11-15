"""PK/PD evidence rows retain conditions; unlike units or contexts are never pooled."""
import math

FIELDS = {'compound', 'endpoint', 'value', 'units', 'species', 'population', 'dose',
          'route', 'schedule', 'matrix', 'source_id', 'source_passage', 'kind'}


def validate_pkpd(rows, evidence, fulltexts=None):
    sources = {e['id'] for e in evidence}
    accepted = []
    for row in rows:
        missing = FIELDS - row.keys()
        if missing:
            raise ValueError('PK/PD row missing context: ' + ','.join(sorted(missing)))
        if row['source_id'] not in sources:
            continue
        value = row['value']
        if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value):
            raise ValueError('PK/PD value must be finite')
        if not row['source_passage'].strip():
            raise ValueError('PK/PD source passage required')
        if fulltexts is not None:
            text = fulltexts.get(row['source_id'], '')
            norm = lambda s: ' '.join(s.split())
            if norm(row['source_passage']) not in norm(text):
                raise ValueError('Extracted passage not found in source document')
        accepted.append(dict(row))
    return accepted
