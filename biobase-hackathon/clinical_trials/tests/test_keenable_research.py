import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from clinical_trials.cache import TTLCache
from clinical_trials.keenable_research import KeenableTrialResearchProvider


class FakeKeenableClient:
    def __init__(self):
        self.calls = []

    def search(self, query, **options):
        self.calls.append((query, options))
        if "recruiting" in query:
            results = [SimpleNamespace(
                title="Cancer Center trial listing",
                url="https://hospital.example/trials/NCT06058377",
                snippet="This study is recruiting at our cancer center.",
                published_at="2026-10-01T00:00:00Z",
            )]
        else:
            results = [SimpleNamespace(
                title="Protocol publication",
                url="https://pubmed.ncbi.nlm.nih.gov/12345/",
                snippet="The published protocol describes the study design.",
                published_at="2025-02-01T00:00:00Z",
            )]
        return SimpleNamespace(results=results)


class KeenableResearchTests(unittest.TestCase):
    def test_builds_cited_dossier_without_patient_data(self):
        client = FakeKeenableClient()
        provider = KeenableTrialResearchProvider(
            client=client,
            now=lambda: datetime(2026, 11, 14, tzinfo=timezone.utc),
        )
        dossier = provider.research("nct06058377", "Public trial title")

        self.assertEqual(dossier["nct_id"], "NCT06058377")
        self.assertEqual(len(dossier["sources"]), 2)
        self.assertEqual(dossier["sources"][0]["category"], "recruitment_or_site")
        self.assertEqual(dossier["sources"][1]["category"], "publication_or_protocol")
        self.assertTrue(all("NCT06058377" in query for query, _ in client.calls))
        expected_exclusions = ["clinicaltrials.gov", "clinicaltrialsfind.com", "eligibility.info"]
        self.assertTrue(all(options["exclude_domains"] == expected_exclusions for _, options in client.calls))

    def test_caches_dossier_by_public_trial_id(self):
        client = FakeKeenableClient()
        provider = KeenableTrialResearchProvider(client=client, cache=TTLCache(ttl_seconds=60))
        provider.research("NCT06058377")
        provider.research("NCT06058377")
        self.assertEqual(len(client.calls), 2)

    def test_rejects_non_nct_input(self):
        provider = KeenableTrialResearchProvider(client=FakeKeenableClient())
        with self.assertRaisesRegex(ValueError, "NCT followed by eight digits"):
            provider.research("patient has breast cancer")


if __name__ == "__main__":
    unittest.main()
