import unittest

from clinical_trials.matching import assess
from clinical_trials.models import PatientProfile, TrialRecord
from clinical_trials.service import build_discovery_result


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

    def test_common_ilc_and_er_staining_aliases_are_explicit_requirements(self):
        alias_trial = trial()
        alias_trial.eligibility_text = """Inclusion Criteria:
* Newly diagnosed ILC confirmed on core-needle biopsy (greater than or equal to 1 percent ER staining)
Exclusion Criteria:
"""
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female",
            "histology": "invasive ductal carcinoma", "biomarkers": {"ER": "negative"},
        })
        result = assess(profile, alias_trial)
        self.assertEqual(result.assessment, "not_a_match")
        self.assertEqual(len(result.exclusions), 2)

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

    def test_stage_zero_is_a_supported_overall_stage(self):
        stage_zero_trial = trial()
        stage_zero_trial.eligibility_text = "Inclusion Criteria:\n* Stage 0 breast cancer\nExclusion Criteria:\n"
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female", "stage": "Stage 0",
        })
        result = assess(profile, stage_zero_trial)
        self.assertEqual(result.assessment, "likely_relevant")
        self.assertIn("overall stage is within Stage 0", result.matched_facts)

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

    def test_coordinates_take_precedence_over_text_when_radius_is_present(self):
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female",
            "location": {
                "query": "Palo Alto, CA", "latitude": 37.443,
                "longitude": -122.145, "radius_miles": 25,
            },
        })
        result = assess(profile, trial())
        self.assertEqual(result.location_status, "within_preferred_radius")
        self.assertIsNotNone(result.distance_miles)

    def test_known_mismatches_are_collapsed_by_default(self):
        profile = PatientProfile.from_dict({
            "primary_organ": "breast", "age_years": 47, "sex": "female",
            "histology": "invasive ductal carcinoma", "stage": "Stage II",
            "biomarkers": {"ER": "negative", "HER2": "negative"},
        })
        output = build_discovery_result(profile, [trial()])
        self.assertEqual(output["summary"]["not_a_match"], 1)
        self.assertEqual(output["results"], [])
        expanded = build_discovery_result(profile, [trial()], include_not_matches=True)
        self.assertEqual(len(expanded["results"]), 1)


if __name__ == "__main__":
    unittest.main()
