import unittest

from clinical_trials.cache import TTLCache
from clinical_trials.geocoding import NominatimGeocoder


class GeocodingTests(unittest.TestCase):
    def test_geocodes_and_caches_human_location(self):
        calls = []

        def fetch(url, headers):
            calls.append((url, headers))
            return [{"lat": "37.4419", "lon": "-122.1430", "display_name": "Palo Alto, California"}]

        geocoder = NominatimGeocoder(cache=TTLCache(ttl_seconds=60), fetch_json=fetch)
        first = geocoder.geocode("Palo Alto, CA")
        second = geocoder.geocode("palo alto, ca")

        self.assertEqual(first["latitude"], 37.4419)
        self.assertEqual(second, first)
        self.assertEqual(len(calls), 1)
        self.assertIn("q=Palo+Alto%2C+CA", calls[0][0])
        self.assertIn("dnaforge", calls[0][1]["User-Agent"])

    def test_unknown_location_has_actionable_error(self):
        geocoder = NominatimGeocoder(fetch_json=lambda url, headers: [])
        with self.assertRaisesRegex(ValueError, "could not be found"):
            geocoder.geocode("not a real place")


if __name__ == "__main__":
    unittest.main()
