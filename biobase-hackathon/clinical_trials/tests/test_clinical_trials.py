import unittest

from clinical_trials.clinicaltrials_gov import ClinicalTrialsGovClient
from clinical_trials.cache import TTLCache
from clinical_trials.matching import assess
from clinical_trials.models import PatientProfile
from clinical_trials.task_a_adapter import profile_from_task_a_fields


STUDY = {
    "protocolSection": {
        "identificationModule": {"nctId": "NCT00000001", "briefTitle": "Breast cancer study"},
        "statusModule": {"overallStatus": "RECRUITING"},
        "conditionsModule": {"conditions": ["Breast Cancer"]},
        "designModule": {"interventions": [{"name": "Example drug"}]},
        "eligibilityModule": {
            "eligibilityCriteria": "Inclusion: ...",
            "sex": "FEMALE",
            "minimumAge": "18 Years",
            "maximumAge": "75 Years",
        },
        "contactsLocationsModule": {"locations": [{"facility": "Example Hospital", "city": "Palo Alto", "country": "United States"}]},
    }
}


class ClinicalTrialsContractTests(unittest.TestCase):
    def setUp(self):
        self.profile = PatientProfile.from_dict({
            "patient_reference": "case-42",
            "primary_organ": "breast",
            "age_years": 47,
            "sex": "female",
            "biomarkers": {"HER2": "negative"},
        })

    def test_client_normalizes_official_response(self):
        seen = []

        def fake_get(url):
            seen.append(url)
            return {"studies": [STUDY]}

        trials = ClinicalTrialsGovClient(get_json=fake_get).search_open_trials(self.profile)
        self.assertIn("query.cond=breast", seen[0])
        self.assertEqual(trials[0].nct_id, "NCT00000001")
        self.assertEqual(trials[0].locations[0]["city"], "Palo Alto")

    def test_assessment_is_likely_relevant_not_eligible(self):
        trial = ClinicalTrialsGovClient(get_json=lambda _: {"studies": [STUDY]}).search_open_trials(self.profile)[0]
        result = assess(self.profile, trial)
        self.assertEqual(result.assessment, "likely_relevant")
        self.assertIn("must confirm eligibility", result.review_note)

    def test_known_age_exclusion_is_flagged(self):
        profile = PatientProfile.from_dict({"primary_organ": "breast", "age_years": 16, "sex": "female"})
        trial = ClinicalTrialsGovClient(get_json=lambda _: {"studies": [STUDY]}).search_open_trials(profile)[0]
        result = assess(profile, trial)
        self.assertEqual(result.assessment, "not_a_match")
        self.assertIn("below trial minimum age of 18 Years", result.exclusions)

    def test_client_cache_avoids_duplicate_registry_calls(self):
        calls = []
        client = ClinicalTrialsGovClient(
            get_json=lambda url: calls.append(url) or {"studies": [STUDY]},
            cache=TTLCache(ttl_seconds=60),
        )
        client.search_open_trials(self.profile)
        client.search_open_trials(self.profile)
        self.assertEqual(len(calls), 1)

    def test_location_query_is_sent_only_when_supplied(self):
        seen = []
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "location": {"query": "Palo Alto, CA"},
        })
        ClinicalTrialsGovClient(get_json=lambda url: seen.append(url) or {"studies": []}).search_open_trials(profile)
        self.assertIn("query.locn=Palo+Alto%2C+CA", seen[0])

    def test_task_a_adapter_keeps_age_band_as_evidence_not_exact_age(self):
        profile = profile_from_task_a_fields({
            "organ": "breast",
            "sex": "F",
            "age_band": "45-49",
            "Biomarkers": "ER negative; PR negative; HER2 negative",
            "Tumor size": "2.4 cm",
            "Pathologic stage (AJCC 8th ed.)": "pT2 pN1",
        }, patient_reference="case-42")
        self.assertEqual(profile.biomarkers["HER2"], "negative")
        self.assertIsNone(profile.age_years)
        self.assertEqual(profile.tumor_size_mm, 24)
        self.assertEqual(profile.pathology_facts["age_band"], "45-49")
        self.assertEqual(profile.fact_sources["tumor_size"], "pathology_report")


if __name__ == "__main__":
    unittest.main()
