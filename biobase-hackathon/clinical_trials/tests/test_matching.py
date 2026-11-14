import unittest

from clinical_trials.matching import assess
from clinical_trials.models import PatientProfile, TrialRecord


ELIGIBILITY = """Inclusion Criteria:

* Adults assigned female sex at birth
* New diagnosis of clinical stage I-III ER-positive, HER2-negative invasive lobular carcinoma
* Minimum tumor size of ≥1.5 cm
* No prior treatment for current diagnosis

Exclusion Criteria:

* Evidence of distant metastatic disease
"""


def trial():
    return TrialRecord(
        nct_id="NCT00000002",
        title="Lobular breast cancer study",
        status="RECRUITING",
        conditions=["Breast Cancer"],
        eligibility_text=ELIGIBILITY,
        sexes_eligible="FEMALE",
        minimum_age="18 Years",
        locations=[{
            "facility": "Nearby Cancer Center",
            "city": "Palo Alto",
            "latitude": 37.4419,
            "longitude": -122.1430,
        }],
        official_url="https://clinicaltrials.gov/study/NCT00000002",
        retrieved_at="2026-11-14T12:00:00+00:00",
        last_update_posted="2026-11-10",
    )


class ConservativeMatcherTests(unittest.TestCase):
    def test_known_histology_and_biomarker_conflicts_are_not_a_match(self):
        profile = PatientProfile.from_dict({
            "primary_organ": "breast",
            "age_years": 47,
            "sex": "female",
            "histology": "invasive ductal carcinoma",
            "stage": "Stage II",
            "metastatic_status": "non_metastatic",
            "tumor_size_mm": 24,
            "treatment_naive": True,
            "biomarkers": {"ER": "negative", "HER2": "negative"},
        })
        result = assess(profile, trial())
        self.assertEqual(result.assessment, "not_a_match")
        self.assertTrue(any("histology" in reason for reason in result.exclusions))
        self.assertTrue(any("ER is positive" in reason for reason in result.exclusions))

    def test_missing_facts_create_questions_with_implications(self):
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female",
            "histology": "invasive lobular carcinoma",
            "stage": "Stage II", "biomarkers": {"ER": "positive", "HER2": "negative"},
        })
        result = assess(profile, trial())
        self.assertEqual(result.assessment, "needs_more_information")
        question_ids = {question.question_id for question in result.clarification_questions}
        self.assertEqual(question_ids, {"has_metastatic_disease", "minimum_tumor_size", "treatment_naive"})
        self.assertTrue(all(question.yes_effect and question.no_effect for question in result.clarification_questions))

    def test_answers_reclassify_to_likely_relevant(self):
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female",
            "histology": "invasive lobular carcinoma",
            "stage": "Stage II", "biomarkers": {"ER": "positive", "HER2": "negative"},
        })
        result = assess(profile, trial(), answers={
            "has_metastatic_disease": "no",
            "minimum_tumor_size": "yes",
            "treatment_naive": "yes",
        })
        self.assertEqual(result.assessment, "likely_relevant")
        self.assertFalse(result.clarification_questions)

    def test_no_answer_can_reclassify_to_not_a_match(self):
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female",
            "histology": "invasive lobular carcinoma", "stage": "Stage II",
            "metastatic_status": "non_metastatic", "tumor_size_mm": 24,
            "biomarkers": {"ER": "positive", "HER2": "negative"},
        })
        result = assess(profile, trial(), answers={"treatment_naive": "no"})
        self.assertEqual(result.assessment, "not_a_match")

    def test_location_is_ranked_locally(self):
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female",
            "histology": "invasive lobular carcinoma", "stage": "Stage II",
            "metastatic_status": "non_metastatic", "tumor_size_mm": 24,
            "treatment_naive": True,
            "biomarkers": {"ER": "positive", "HER2": "negative"},
            "location": {"latitude": 37.443, "longitude": -122.145, "radius_miles": 25},
        })
        result = assess(profile, trial())
        self.assertEqual(result.location_status, "within_preferred_radius")
        self.assertLess(result.distance_miles, 1)
        self.assertEqual(result.nearest_site["facility"], "Nearby Cancer Center")
        self.assertEqual(result.source_last_updated, "2026-11-10")


if __name__ == "__main__":
    unittest.main()
