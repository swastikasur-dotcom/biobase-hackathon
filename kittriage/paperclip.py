"""Paperclip is the primary trial/literature adapter; public adapters are explicit fallbacks."""
import os
from urllib.parse import quote
from .io import utcnow


class Paperclip:
    base = 'https://paperclip.gxl.ai/api/v1/'

    def __init__(self, http, key=None):
        self.http = http
        self.key = key or os.environ.get('PAPERCLIP_API_KEY')
        if not self.key:
            raise ValueError('Set PAPERCLIP_API_KEY in your environment')

    def call(self, route, body=None):
        return self.http.json(self.base + route, body, {'X-API-Key': self.key}, cache=False)

    def search(self, query, sources, limit=20, as_of=None, fulltext=False):
        body = {'query': query, 'sources': sources, 'num_results': limit}
        if fulltext:
            # 2026-11 live server rejects text/highlights although present in OpenAPI.
            raise ValueError('Paperclip REST full-text flags are not live. Use the documented CLI virtual filesystem for source passages.')
        if as_of:
            # Year filter is only coarse retrieval; exact publication dates are checked during curation.
            body['filters'] = {'max_year': int(as_of[:4])}
        return self.call('search', body)

    def document(self, document_id):
        return self.call('documents/' + quote(document_id, safe=':'))

    def fulltext(self, pmcid):
        """Official CLI gateway contract, as implemented by gxl-paperclip 0.8.17."""
        import re
        if not re.fullmatch(r'PMC\d+', pmcid):
            raise ValueError('Full-text reader accepts a PMC identifier')
        return self.http.json('https://paperclip.gxl.ai/api/cli/execute',
                              {'command': 'cat', 'raw': '--full /papers/' + pmcid + '/content.lines',
                               'no_color': True, 'plain': True},
                              {'X-API-Key': self.key}, cache=False)

    def target_evidence(self, as_of=None):
        queries = {
            'trials': ('KIT mutant gastrointestinal stromal tumor trial imatinib sunitinib regorafenib ripretinib avapritinib terminated withdrawn why stopped', ['trials/us']),
            'failures': ('KIT GIST secondary resistance V654A T670I D820 N822 Y823 VOYAGER INTRIGUE', ['pmc']),
            'pkpd': ('GIST KIT inhibitor pharmacokinetics plasma exposure unbound concentration half life clearance pharmacodynamics dose limiting toxicity', ['pmc']),
        }
        data = {'retrieved_at': utcnow(), 'as_of': as_of, 'status': 'retrieved_requires_curation'}
        for name, (query, sources) in queries.items():
            data[name] = self.search(query, sources, as_of=as_of)
        return data
