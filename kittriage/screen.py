"""Documented Ptarmigan API. Custom protein sequences are deliberately unsupported."""
from decimal import Decimal, InvalidOperation
import os
from urllib.parse import urlencode, quote
from uuid import uuid4
from .io import read_json, write_json, utcnow


class Ptarmigan:
    base = 'https://ptarmigan.app/api/v1/'

    def __init__(self, http, key=None):
        self.http = http
        self.key = key or os.environ.get('PTARMIGAN_API_KEY')
        if not self.key:
            raise ValueError('Set PTARMIGAN_API_KEY in your environment')

    def call(self, route, body=None, extra_headers=None):
        headers = {'Authorization': 'Bearer ' + self.key, **(extra_headers or {})}
        return self.http.json(self.base + route, body, headers, cache=False)

    def pages(self, route, params=None):
        params = {**(params or {}), 'limit': 100}
        while True:
            response = self.call(route + '?' + urlencode(params))
            yield from response['data']
            after = response.get('next_after')
            if not after:
                return
            params['after'] = after

    def inspect(self, gene='KIT'):
        proteins = [p for p in self.pages('proteins', {'search': gene}) if p['gene'] == gene]
        return {'retrieved_at': utcnow(), 'proteins': proteins,
                'libraries': list(self.pages('compound-collections')),
                'custom_sequences_supported': False}

    def estimate(self, protein_id, collection_id):
        return self.call('screens/estimate', {'protein_id': protein_id, 'collection_id': collection_id})

    def submit(self, protein_id, collection_id, max_cost_usd, state_path):
        """Caller must explicitly approve an estimate before invoking. No automatic charged retry."""
        try:
            ceiling = Decimal(str(max_cost_usd))
        except InvalidOperation:
            raise ValueError('Invalid budget') from None
        if not ceiling.is_finite() or ceiling < 0:
            raise ValueError('Budget must be finite and nonnegative')
        estimate = self.estimate(protein_id, collection_id)
        cost = Decimal(estimate['cost_usd'])
        if not cost.is_finite() or cost < 0 or cost > ceiling:
            raise ValueError('Fresh estimate exceeds approved maximum or is invalid')
        if not estimate['sufficient']:
            raise ValueError('Insufficient prepaid balance')
        from pathlib import Path
        state_file = Path(state_path)
        request = {'protein_id': protein_id, 'collection_id': collection_id}
        if state_file.exists():
            state = read_json(state_file)
            if state['request'] != request:
                raise ValueError('State belongs to a different screen; choose a new state path')
            if state.get('response'):
                return state['response']
        else:
            state = {'request': request, 'idempotency_key': str(uuid4()), 'estimate': estimate, 'created_at': utcnow()}
            write_json(state_file, state)
        # Persist key before sending. Same state file means same idempotent request after a lost response.
        response = self.call('screens', request, {'Idempotency-Key': state['idempotency_key']})
        state['response'] = response
        write_json(state_file, state)
        return response

    def status(self, screen_id):
        return self.call('screens/' + quote(screen_id, safe=''))

    def hits(self, screen_id):
        return list(self.pages('screens/' + quote(screen_id, safe='') + '/hits'))


def selectivity_margin(on_target, off_target):
    """Ratio only for matched IC50 endpoints, units, methods and biological assay context."""
    for key in ('units', 'endpoint', 'comparison_group', 'kind'):
        if not on_target.get(key) or on_target.get(key) != off_target.get(key):
            raise ValueError('Incomparable selectivity measurements: ' + key)
    if on_target['endpoint'] != 'IC50' or on_target['units'] != 'nM':
        raise ValueError('Selectivity calculation requires IC50 in nM')
    if on_target.get('censored') or off_target.get('censored'):
        raise ValueError('Censored IC50 values need interval-aware review')
    import math
    a, b = on_target['value'], off_target['value']
    if any(isinstance(v, bool) or not isinstance(v, (int,float)) or not math.isfinite(v) or v <= 0 for v in (a,b)):
        raise ValueError('IC50 values must be positive and finite')
    return {'value': b/a, 'units': 'fold', 'kind': on_target['kind'],
            'source': on_target.get('source', '') + ' / ' + off_target.get('source', ''),
            'context': {'on_target': on_target.get('target'), 'off_target': off_target.get('target'),
                        'comparison_group': on_target['comparison_group']}}
