"""Replaceable forward geocoder used by the local trial demo."""

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class NominatimGeocoder:
    """Resolve one user-entered place using the public OSM Nominatim endpoint.

    This is suitable for the low-volume demo only. Production callers should
    inject a geocoder with an appropriate service agreement.
    """

    endpoint = "https://nominatim.openstreetmap.org/search"

    def __init__(self, cache=None, fetch_json=None, user_agent=None):
        self.cache = cache
        self.fetch_json = fetch_json or self._fetch_json
        self.user_agent = user_agent or "dnaforge-clinical-trial-demo/0.1 (local hackathon prototype)"

    def geocode(self, query):
        query = str(query or "").strip()
        if not query:
            raise ValueError("A city, ZIP code, or region is required when using a radius")
        cache_key = "geocode:" + query.casefold()
        if self.cache:
            cached = self.cache.get(cache_key)
            if cached is not None:
                return cached

        url = self.endpoint + "?" + urlencode({"q": query, "format": "jsonv2", "limit": 1})
        rows = self.fetch_json(url, {"User-Agent": self.user_agent})
        if not rows:
            raise ValueError("Location could not be found. Try a city with state/country, or a ZIP code.")
        result = {
            "latitude": float(rows[0]["lat"]),
            "longitude": float(rows[0]["lon"]),
            "resolved_name": rows[0].get("display_name", query),
        }
        if self.cache:
            self.cache.set(cache_key, result)
        return result

    @staticmethod
    def _fetch_json(url, headers):
        request = Request(url, headers=headers)
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
