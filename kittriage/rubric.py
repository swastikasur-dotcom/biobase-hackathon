"""Traceable rule derivation. Scientific findings and analyst policy stay distinct."""
import math
from copy import deepcopy

REQUIRED = {'id', 'criterion', 'origin_drug', 'evidence', 'evidence_type', 'direction',
            'metric', 'measurable_by', 'hard_filter', 'layer', 'weight', 'policy_rationale',
            'threshold', 'units', 'supersedes'}


def validate_rule(rule, evidence_ids):
    missing = REQUIRED - rule.keys()
    if missing:
        raise ValueError('Criterion missing fields: ' + ', '.join(sorted(missing)))
    if rule['direction'] not in {'minimize', 'maximize', 'avoid'}:
        raise ValueError('Invalid direction')
    if rule['layer'] not in {'static', 'derived'}:
        raise ValueError('Invalid layer')
    if not isinstance(rule['hard_filter'], bool):
        raise ValueError('hard_filter must be boolean')
    if not isinstance(rule['weight'], (int, float)) or isinstance(rule['weight'], bool) or not math.isfinite(rule['weight']) or rule['weight'] <= 0:
        raise ValueError('weight must be positive and finite')
    if not rule['evidence'] or not set(rule['evidence']) <= evidence_ids:
        raise ValueError('Criterion has missing or unavailable citations: ' + rule['id'])
    threshold = rule['threshold']
    if threshold is not None and (isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not math.isfinite(threshold)):
        raise ValueError('Threshold must be finite number or null')
    if rule['measurable_by'] is not None and threshold is None:
        raise ValueError('Measurable criterion needs an explicit threshold')
    if not isinstance(rule['supersedes'], list):
        raise ValueError('supersedes must be a list')
    if rule.get('scoring')=='continuous':
        bounds=rule.get('utility_bounds')
        if rule['hard_filter'] or not isinstance(bounds,list) or len(bounds)!=2 or bounds[1]<=bounds[0]:
            raise ValueError('Continuous utility needs increasing bounds and cannot be a hard filter')


def resolve_overrides(rules):
    by_id = {r['id']: r for r in rules}
    if len(by_id) != len(rules):
        raise ValueError('Duplicate criterion id')
    overridden, audit = set(), []
    for rule in rules:
        for replaced_id in rule['supersedes']:
            if replaced_id not in by_id:
                raise ValueError('Override refers to absent rule: ' + replaced_id)
            old = by_id[replaced_id]
            if rule['layer'] != 'derived' or old['layer'] != 'static':
                raise ValueError('Only a derived criterion may override a static criterion')
            if replaced_id in overridden:
                raise ValueError('Conflicting overrides for ' + replaced_id)
            overridden.add(replaced_id)
            audit.append({'replaced': old['id'], 'replacement': rule['id'],
                          'reason': rule['policy_rationale'], 'evidence': rule['evidence']})
    return [r for r in rules if r['id'] not in overridden], audit


def derive_rubric(bundle, evidence, as_of=None):
    ids = {e['id'] for e in evidence}
    rules, omitted = [], []
    for template in bundle['criteria']:
        rule = deepcopy(template)
        if not set(rule['evidence']) <= ids:
            omitted.append({'id': rule['id'], 'reason': 'supporting evidence unavailable at cutoff'})
            continue
        validate_rule(rule, ids)
        rules.append(rule)
    # An override that loses its supporting baseline to the cutoff is retained as a standalone rule.
    present = {r['id'] for r in rules}
    for rule in rules:
        rule['supersedes'] = [i for i in rule['supersedes'] if i in present]
    active, overrides = resolve_overrides(rules)
    return {'schema_version': '1.0', 'target': 'KIT', 'indication': 'GIST', 'as_of': as_of,
            'derivation': 'Deterministic selection of analyst-authored criteria linked to curated evidence; no autonomous LLM extraction claimed.',
            'thresholds': 'Research triage policy, not thresholds established by the cited trials.',
            'criteria': active, 'all_criteria': rules, 'overrides': overrides, 'omitted': omitted,
            'evidence_ledger': evidence}
