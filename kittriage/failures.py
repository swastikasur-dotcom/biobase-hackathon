"""Evidence filtering uses publication dates, not retrieval dates."""
from datetime import date


def classify_stop_reason(reason):
    """Conservative text grouping; preserve exact registry wording alongside this label."""
    if not reason:
        return 'not_reported'
    text = reason.casefold()
    if any(word in text for word in ['dose-limiting', 'toxicit', 'safety concern']):
        return 'toxicity_signal'
    if any(word in text for word in ['futility', 'lack of efficacy']):
        return 'efficacy_signal'
    if any(word in text for word in ['accrual', 'enrollment', 'business decision', 'portfolio', 'strategy',
                                     'withdrew interest', 'production stopped', 'funding sponsor']):
        return 'operational_or_business'
    return 'requires_review'


def filter_evidence(bundle, as_of=None):
    if as_of:
        date.fromisoformat(as_of)
    included, excluded = [], []
    ids = set()
    for evidence in bundle['evidence']:
        for field in ['id', 'title', 'url', 'published_on', 'evidence_type', 'finding', 'tags']:
            if field not in evidence:
                raise ValueError(f'Evidence missing {field}')
        if evidence['id'] in ids:
            raise ValueError('Duplicate evidence id: ' + evidence['id'])
        ids.add(evidence['id'])
        published = evidence['published_on']
        if published:
            date.fromisoformat(published)
        if as_of and (not published or published > as_of):
            excluded.append({'id': evidence['id'], 'reason': 'undated' if not published else 'after_cutoff'})
        else:
            included.append(evidence)
    return included, excluded
