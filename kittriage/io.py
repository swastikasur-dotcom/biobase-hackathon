"""Small, auditable HTTP cache. Credentials never enter cache metadata."""
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')


class ApiError(RuntimeError):
    def __init__(self, status, code):
        self.status, self.code = status, code
        super().__init__(f'HTTP {status}: {code}')


class HttpClient:
    def __init__(self, cache_dir=None, offline=False, refresh=False):
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.offline, self.refresh = offline, refresh

    def json(self, url, body=None, headers=None, cache=True, retry_safe=False, allow_text=False):
        # Authenticated calls are not cached unless explicitly directed by callers.
        identity = json.dumps([url, body], sort_keys=True).encode()
        key = hashlib.sha256(identity).hexdigest()
        cached = self.cache_dir / (key + '.json') if self.cache_dir and cache else None
        if cached and cached.exists() and (self.offline or not self.refresh):
            return read_json(cached)['data']
        if self.offline:
            raise ApiError(0, 'offline_cache_miss')
        request_headers = {'User-Agent': 'KIT-Evidence-Workbench/0.1', 'Accept': 'application/json'}
        request_headers.update(headers or {})
        data = None
        if body is not None:
            data = json.dumps(body, allow_nan=False).encode()
            request_headers['Content-Type'] = 'application/json'
        attempts = 3 if (body is None or retry_safe) else 1
        for attempt in range(attempts):
            try:
                with urlopen(Request(url, data=data, headers=request_headers), timeout=30) as response:
                    raw = response.read().decode('utf-8')
                    try:
                        result = json.loads(raw)
                    except json.JSONDecodeError:
                        if not allow_text:
                            raise
                        result = {'message':raw}
                if cached:
                    write_json(cached, {'url': url, 'retrieved_at': utcnow(), 'data': result})
                return result
            except HTTPError as exc:
                if exc.code in {429, 502, 503, 504} and attempt + 1 < attempts:
                    time.sleep(2 ** attempt)
                    continue
                # Do not print response bodies, which could echo authorization data.
                raise ApiError(exc.code, 'request_failed') from None
            except (URLError, TimeoutError, json.JSONDecodeError):
                if attempt + 1 < attempts:
                    time.sleep(2 ** attempt)
                    continue
                raise ApiError(0, 'connection_or_json_error') from None
        raise ApiError(0, 'request_failed')
