"""Program retrieval keeps registry status separate from clinical interpretation."""
from urllib.parse import urlencode
from .io import utcnow

KNOWN_NAMES = {
    'imatinib': ['STI571', 'STI-571', 'Gleevec', 'Glivec'],
    'sunitinib': ['SU11248', 'Sutent'],
    'regorafenib': ['BAY 73-4506', 'Stivarga'],
    'ripretinib': ['DCC-2618', 'Qinlock'],
    'avapritinib': ['BLU-285', 'Ayvakit', 'Ayvakyt'],
    'bezuclastinib': ['CGT9486', 'PLX9486'],
}


def normalize_name(value):
    key = ''.join(c for c in value.casefold() if c.isalnum())
    for generic, aliases in KNOWN_NAMES.items():
        if key in {''.join(c for c in n.casefold() if c.isalnum()) for n in [generic, *aliases]}:
            return generic
    return value.strip()


def fetch_trials(client, pages=2):
    params = {'query.cond': 'gastrointestinal stromal tumor',
              'query.intr': 'imatinib OR sunitinib OR regorafenib OR ripretinib OR avapritinib OR bezuclastinib',
              'pageSize': 50, 'format': 'json', 'countTotal': 'true'}
    rows, total, next_token = [], None, None
    for _ in range(pages):
        if next_token:
            params['pageToken'] = next_token
        response = client.json('https://clinicaltrials.gov/api/v2/studies?' + urlencode(params))
        total = response.get('totalCount', total)
        for study in response.get('studies', []):
            p = study.get('protocolSection', {})
            ident, status = p.get('identificationModule', {}), p.get('statusModule', {})
            nct = ident.get('nctId')
            if not nct:
                continue
            sponsor = p.get('sponsorCollaboratorsModule', {}).get('leadSponsor', {}).get('name')
            drugs = [i['name'] for i in p.get('armsInterventionsModule', {}).get('interventions', [])
                     if i.get('type') == 'DRUG']
            rows.append({'nct_id': nct, 'title': ident.get('briefTitle'),
                         'drugs': drugs, 'normalized_drugs': [normalize_name(n) for n in drugs],
                         'sponsor': sponsor,
                         'phase': p.get('designModule', {}).get('phases', []),
                         'status': status.get('overallStatus'),
                         'why_stopped': status.get('whyStopped'),
                         'first_posted': status.get('studyFirstSubmitDate'),
                         'last_update': status.get('lastUpdatePostDateStruct', {}).get('date'),
                         'url': 'https://clinicaltrials.gov/study/' + nct})
        next_token = response.get('nextPageToken')
        if not next_token:
            break
    return {'retrieved_at': utcnow(), 'total_matches': total, 'returned': len(rows),
            'truncated': bool(next_token), 'studies': rows,
            'scope': 'Registry keyword sample; not an exhaustive KIT program landscape. Sponsor is not necessarily current owner.'}


def keenable_search(client, key, query, as_of=None):
    body = {'query': query, 'max_results': 8, 'snippet_max_length': 800, 'disable_cards': True}
    if as_of:
        body['published_before'] = as_of
    response = client.json('https://api.keenable.ai/v1/search', body,
                           {'X-API-Key': key}, cache=False)
    # Raw snippets are discovery leads, never automatically treated as clinical evidence.
    return {'retrieved_at': utcnow(), 'query': query, 'results': response.get('results', []),
            'status': 'retrieved_unreviewed', 'as_of': as_of}
