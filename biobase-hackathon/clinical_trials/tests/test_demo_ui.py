import unittest
from unittest.mock import patch

from clinical_trials.demo_ui.server import STATIC_DIR, run_parse_report, run_research, run_search
from clinical_trials.models import TrialRecord


class DemoUiTests(unittest.TestCase):
    def test_demo_exposes_human_location_and_radius_inputs(self):
        html = (STATIC_DIR / "index.html").read_text()
        script = (STATIC_DIR / "app.js").read_text()
        self.assertIn('name="use_radius"', html)
        self.assertIn('name="location_query"', html)
        self.assertIn('name="radius_miles"', html)
        self.assertIn('id="radiusFields" class="two-col location-inputs hidden"', html)
        self.assertIn('setRadiusEnabled(false)', script)
        self.assertIn("radius_miles: Number(data.get('radius_miles'))", script)
        self.assertIn('Find independent sources', html)
        self.assertIn('participating-centre pages', html)
        self.assertIn('Sources must visibly mention this NCT ID', html)
        self.assertIn("fetch('/api/research'", script)
        self.assertIn('registry_last_updated: trial.last_update_posted', script)
        self.assertIn('source.evidence_quote', script)

    def test_synthetic_report_can_prefill_profile(self):
        report = """Patient: F, age band 45-49 | Report year: 2024
SPECIMEN: Left breast, lumpectomy
FINAL DIAGNOSIS:
Invasive ductal carcinoma.
Histologic type: Invasive ductal carcinoma
Tumor size: 24 mm
Biomarkers: ER negative; PR negative; HER2 negative
Pathologic stage (AJCC 8th ed.): pT2 pN1
GROSS DESCRIPTION:
Synthetic example.
"""
        output = run_parse_report({"report_text": report})
        self.assertEqual(output["profile"]["primary_organ"], "breast")
        self.assertEqual(output["profile"]["tumor_size_mm"], 24)
        self.assertEqual(output["profile"]["biomarkers"]["HER2"], "negative")

    def test_search_response_joins_trial_display_data(self):
        trial = TrialRecord(
            nct_id="NCT00000003",
            title="Demo breast trial",
            status="RECRUITING",
            conditions=["Breast Cancer"],
            sexes_eligible="ALL",
            minimum_age="18 Years",
            official_url="https://clinicaltrials.gov/study/NCT00000003",
        )
        payload = {
            "profile": {"primary_organ": "breast", "age_years": 47, "sex": "female"},
            "page_size": 5,
        }
        with patch("clinical_trials.demo_ui.server.CLIENT.search_open_trials", return_value=[trial]):
            output = run_search(payload)
        self.assertEqual(output["summary"]["likely_relevant"], 1)
        self.assertEqual(output["results"][0]["trial"]["title"], "Demo breast trial")
        self.assertEqual(output["results"][0]["source_url"], trial.official_url)

    def test_location_radius_is_resolved_before_matching(self):
        trial = TrialRecord(
            nct_id="NCT00000004",
            title="Local breast trial",
            status="RECRUITING",
            conditions=["Breast Cancer"],
            sexes_eligible="ALL",
            minimum_age="18 Years",
            locations=[{"facility": "Near site", "latitude": 37.45, "longitude": -122.14}],
        )
        payload = {
            "profile": {
                "primary_organ": "breast",
                "age_years": 47,
                "sex": "female",
                "location": {"query": "Palo Alto, CA", "radius_miles": 25},
            }
        }
        resolved = {"latitude": 37.443, "longitude": -122.145, "resolved_name": "Palo Alto, California"}
        with patch("clinical_trials.demo_ui.server.GEOCODER.geocode", return_value=resolved), \
                patch("clinical_trials.demo_ui.server.CLIENT.search_open_trials", return_value=[trial]):
            output = run_search(payload)
        self.assertEqual(output["profile"]["location"]["radius_miles"], 25)
        self.assertEqual(output["results"][0]["location_status"], "within_preferred_radius")

    def test_research_endpoint_passes_only_public_trial_metadata(self):
        expected = {"nct_id": "NCT00000004", "sources": []}
        with patch("clinical_trials.demo_ui.server.RESEARCH_PROVIDER.research", return_value=expected) as research:
            output = run_research({
                "nct_id": "NCT00000004", "title": "Public title", "registry_last_updated": "2026-11-10", "patient": "ignored",
            })
        self.assertEqual(output, expected)
        research.assert_called_once_with(
            "NCT00000004", title="Public title", registry_last_updated="2026-11-10",
        )


if __name__ == "__main__":
    unittest.main()
