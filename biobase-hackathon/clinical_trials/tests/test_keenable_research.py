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
                title="Cancer Center trial listing for NCT06058377",
                url="https://hospital.example/trials/NCT06058377",
                snippet="NCT06058377 is recruiting at our cancer center.",
                published_at="2026-10-01T00:00:00Z",
            )]
        else:
            results = [SimpleNamespace(
                title="Protocol publication for NCT06058377",
                url="https://pubmed.ncbi.nlm.nih.gov/12345/",
                snippet="The published protocol describes the NCT06058377 study design.",
                published_at="2025-02-01T00:00:00Z",
            )]
        return SimpleNamespace(results=results)

    def fetch(self, url, **options):
        if "hospital.example" in url:
            content = "NCT06058377 is recruiting at our cancer center. Contact the trial office for details."
            title = "Cancer Center trial listing for NCT06058377"
        else:
            content = "NCT06058377 is a published protocol evaluating the study design and treatment schedule for patients."
            title = "Protocol publication for NCT06058377"
        return SimpleNamespace(
            url=url,
            title=title,
            content=content,
            published_at="2026-10-02T00:00:00Z",
        )


class KeenableResearchTests(unittest.TestCase):
    def test_builds_cited_dossier_without_patient_data(self):
        client = FakeKeenableClient()
        provider = KeenableTrialResearchProvider(
            client=client,
            now=lambda: datetime(2026, 11, 14, tzinfo=timezone.utc),
        )
        dossier = provider.research(
            "nct06058377", "Public trial title", registry_last_updated="2026-11-10",
        )

        self.assertEqual(dossier["nct_id"], "NCT06058377")
        self.assertEqual(len(dossier["sources"]), 2)
        self.assertEqual(
            {source["category"] for source in dossier["sources"]},
            {"recruitment_or_site", "publication_or_protocol"},
        )
        self.assertIn("pubmed.ncbi.nlm.nih.gov", dossier["sources"][0]["domain"])
        self.assertTrue(dossier["sources"][0]["trial_specific"])
        self.assertTrue(dossier["sources"][1]["trial_specific"])
        self.assertTrue(all("NCT06058377" in source["evidence_quote"] for source in dossier["sources"]))
        self.assertEqual(dossier["registry_last_updated"], "2026-11-10")
        self.assertTrue(all("NCT06058377" in query for query, _ in client.calls))
        expected_exclusions = [
            "clinicaltrials.gov", "clinicaltrialsfind.com", "eligibility.info",
            "trialytics.ai", "medpath.com", "plaintrial.com", "tundraspace.com",
        ]
        self.assertTrue(all(options["exclude_domains"] == expected_exclusions for _, options in client.calls))

    def test_drops_candidate_when_fetched_page_has_no_direct_evidence(self):
        class NoEvidenceClient(FakeKeenableClient):
            def fetch(self, url, **options):
                return SimpleNamespace(
                    url=url, title="No trial evidence", content="NOT_FOUND", published_at=None,
                )

        dossier = KeenableTrialResearchProvider(client=NoEvidenceClient()).research("NCT06058377")
        self.assertEqual(dossier["sources"], [])

    def test_drops_identifier_only_evidence_that_lacks_source_specific_detail(self):
        class IdentifierOnlyClient(FakeKeenableClient):
            def fetch(self, url, **options):
                return SimpleNamespace(
                    url=url, title="Trial directory", content="ClinicalTrials.gov ID: NCT06058377", published_at=None,
                )

        dossier = KeenableTrialResearchProvider(client=IdentifierOnlyClient()).research("NCT06058377")
        self.assertEqual(dossier["sources"], [])

    def test_drops_directory_style_short_passage(self):
        class DirectoryClient(FakeKeenableClient):
            def fetch(self, url, **options):
                return SimpleNamespace(
                    url=url, title="NCT06058377 - Cancer Center", content="NCT06058377 - Cancer Center", published_at=None,
                )

        dossier = KeenableTrialResearchProvider(client=DirectoryClient()).research("NCT06058377")
        self.assertEqual(dossier["sources"], [])

    def test_drops_results_that_only_match_a_search_url_or_other_trial(self):
        class OffTargetClient:
            def search(self, query, **options):
                return SimpleNamespace(results=[SimpleNamespace(
                    title="Unrelated article NCT00496288",
                    url="https://pmc.ncbi.nlm.nih.gov/?term=NCT06058377",
                    snippet="This article discusses a different NCT00496288 trial.",
                    published_at=None,
                )])

        dossier = KeenableTrialResearchProvider(client=OffTargetClient()).research("NCT06058377")
        self.assertEqual(dossier["sources"], [])

    def test_caches_dossier_by_public_trial_id(self):
        client = FakeKeenableClient()
        provider = KeenableTrialResearchProvider(client=client, cache=TTLCache(ttl_seconds=60))
        provider.research("NCT06058377")
        provider.research("NCT06058377")
        self.assertEqual(len(client.calls), 3)

    def test_rejects_non_nct_input(self):
        provider = KeenableTrialResearchProvider(client=FakeKeenableClient())
        with self.assertRaisesRegex(ValueError, "NCT followed by eight digits"):
            provider.research("patient has breast cancer")


if __name__ == "__main__":
    unittest.main()
