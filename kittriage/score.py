"""Three-tier scorer with explicit missingness, units and provenance."""
import math
from .rubric import validate_rule


def score_compound(compound, rubric):
    criteria = rubric['criteria']
    measurements = compound.get('measurements', {})
    checks, failures, unknowns = [], [], []
    soft_earned, soft_available, soft_total = 0.0, 0.0, 0.0
    for rule in criteria:
        if not rule['hard_filter'] and rule['measurable_by'] is not None:
            soft_total += rule['weight']
        measured = measurements.get(rule['metric'])
        reason = None
        if rule['measurable_by'] is None:
            reason = 'Human review required; no validated automated measure assigned.'
        elif not isinstance(measured, dict) or measured.get('value') is None:
            reason = 'Measurement unavailable.'
        else:
            value = measured.get('value')
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                reason = 'Measurement must be a finite number.'
            elif measured.get('units') != rule['units']:
                reason = f"Unit mismatch: expected {rule['units']}."
            elif measured['units'] in {'probability','fraction'} and not 0 <= value <= 1:
                reason = 'Probability or fraction must be in [0, 1].'
            elif measured['units'] in {'fold','Da','hr'} and value <= 0:
                reason = 'Measurement must be positive.'
            elif not measured.get('source') or measured.get('kind') not in {'prediction', 'computed', 'experimental', 'reviewed'}:
                reason = 'Measurement provenance or kind missing.'
            elif rule.get('required_context') and any(measured.get('context', {}).get(k) != v for k, v in rule['required_context'].items()):
                reason = 'Genotype or assay context does not match the criterion.'
        check = {'criterion_id': rule['id'], 'criterion': rule['criterion'],
                 'hard_filter': rule['hard_filter'], 'evidence': rule['evidence'],
                 'measurement': measured, 'threshold': rule['threshold'], 'units': rule['units']}
        if reason:
            check.update(status='unscoreable', reason=reason)
            unknowns.append(check)
        else:
            value, threshold = measured['value'], rule['threshold']
            passes = value >= threshold if rule['direction'] == 'maximize' else value <= threshold
            utility=1.0 if passes else 0.0
            if rule.get('scoring')=='continuous':
                low,high=rule['utility_bounds']
                utility=max(0,min(1,(value-low)/(high-low)))
                if rule['direction']!='maximize':utility=1-utility
            check.update(status='pass' if passes else 'fail',
                         reason=f"{value:g} {'>=' if rule['direction'] == 'maximize' else '<='} {threshold:g} {rule['units']}")
            if rule['hard_filter'] and not passes:
                failures.append(check)
            if not rule['hard_filter']:
                soft_available += rule['weight']
                soft_earned += rule['weight']*utility
        checks.append(check)
    hard_unknowns = [c for c in unknowns if c['hard_filter']]
    # A missing hard filter can never turn into a pass; absent soft data remain in the denominator.
    if not criteria:
        decision = 'insufficient_rubric'
    elif failures:
        decision = 'reject'
    elif unknowns:
        decision = 'review_required'
    else:
        decision = 'passes_configured_filters'
    return {'id': compound['id'], 'name': compound.get('name', compound['id']),
            'decision': decision, 'checks': checks, 'kill_reasons': failures,
            'unscoreable': unknowns, 'missing_hard_filters': len(hard_unknowns),
            'soft_score': round(100 * soft_earned / soft_total, 1) if soft_total else None,
            'soft_coverage': round(100 * soft_available / soft_total, 1) if soft_total else None,
            'binding_rank':compound.get('ptarmigan',{}).get('rank'),
            'engagement':compound.get('ptarmigan',{}).get('engagement'),
            'note': 'Policy triage result; a pass is not evidence of safety or clinical efficacy.'}


def score_all(compounds, rubric):
    ids={e['id'] for e in rubric.get('evidence_ledger',[])}
    for rule in rubric['criteria']:
        validate_rule(rule,ids)
    if len({c['id'] for c in compounds})!=len(compounds):
        raise ValueError('Duplicate compound identifiers')
    results = [score_compound(c, rubric) for c in compounds]
    priority = {'passes_configured_filters': 0, 'review_required': 1, 'insufficient_rubric': 2, 'reject': 3}
    # Target engagement ranks ahead of property flags: a compound that does not engage KIT
    # cannot be rescued by good ADMET. Soft property score breaks ties within engagement bands.
    def _rank_key(c):
        br = c['binding_rank'] or 999999
        band = (br - 1) // 50  # 50-compound engagement bands
        return (priority[c['decision']], band, -(c['soft_score'] or 0), br, c['name'])
    return sorted(results, key=_rank_key)
