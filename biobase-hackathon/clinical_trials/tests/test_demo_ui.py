import unittest
from unittest.mock import patch

from clinical_trials.demo_ui.server import run_search
from clinical_trials.models import TrialRecord


class DemoUiTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
