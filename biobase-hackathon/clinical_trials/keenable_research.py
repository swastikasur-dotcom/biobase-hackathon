"""Public-web research for shortlisted trials, isolated from matching decisions."""

import re
from datetime import datetime, timezone
from urllib.parse import urlparse


NCT_ID_PATTERN = re.compile(r"^NCT\d{8}$", re.I)


def _source_category(title, url, snippet):
    text = " ".join((title, url, snippet)).lower()
    host = urlparse(url).netloc.lower()
    if any(value in host for value in ("pubmed.", "ncbi.nlm.nih.gov", "doi.org")) or any(
        value in text for value in ("journal", "publication", "abstract", "protocol paper")
    ):
        return "publication_or_protocol"
    if any(value in host for value in ("studyfinder", "clinicaltrials.", "sncrf.org")) or any(
        value in text for value in (
            "recruiting", "recruitment", "enrolling", "cancer center", "hospital",
            "principal investigator", "contact(s)", "nci site",
        )
    ):
        return "recruitment_or_site"
    if any(value in text for value in ("sponsor", "announces", "press release", "biopharma", "therapeutics")):
        return "sponsor_update"
    return "other_public_context"


def _source_priority(source):
    host = source["domain"].lower()
    if host.endswith((".edu", ".gov")) or any(value in host for value in ("pubmed.", "ncbi.nlm.nih.gov")):
        return 0
    if host.endswith(".org"):
        return 1
    return 2


def _mentions_trial_identifier(title, snippet, nct_id):
    """Require the NCT identifier in retrieved content, not merely a search URL."""
    extracted_text = " ".join((str(title or ""), str(snippet or ""))).upper()
    return nct_id in extracted_text


class KeenableTrialResearchProvider:
    """Create a cited public-web dossier from an NCT identifier only."""

    def __init__(self, client=None, cache=None, now=None):
        if client is None:
            from keenable import Keenable

            client = Keenable(client_source="DNA Forge trial research")
        self.client = client
        self.cache = cache
        self.now = now or (lambda: datetime.now(timezone.utc))

    def research(self, nct_id, title=None):
        nct_id = str(nct_id or "").strip().upper()
        if not NCT_ID_PATTERN.fullmatch(nct_id):
            raise ValueError("nct_id must use the format NCT followed by eight digits")
        cache_key = "keenable-trial-research:" + nct_id
        if self.cache:
            cached = self.cache.get(cache_key)
            if cached is not None:
                return cached

        queries = [
            '"{}" recruiting "principal investigator" OR "contact"'.format(nct_id),
            '"{}" site:pubmed.ncbi.nlm.nih.gov OR site:pmc.ncbi.nlm.nih.gov'.format(nct_id),
            '"{}" sponsor announces results'.format(nct_id),
        ]
        collected = []
        seen_urls = set()
        for query in queries:
            response = self.client.search(
                query,
                mode="pro",
                exclude_domains=["clinicaltrials.gov", "clinicaltrialsfind.com", "eligibility.info"],
                snippet_max_length=700,
                max_results=3,
            )
            for result in response.results:
                url = str(result.url or "").strip()
                parsed = urlparse(url)
                if parsed.scheme not in ("http", "https") or not parsed.netloc or url in seen_urls:
                    continue
                snippet = str(result.snippet or "").strip()
                if not _mentions_trial_identifier(result.title, snippet, nct_id):
                    continue
                seen_urls.add(url)
                collected.append({
                    "title": str(result.title or parsed.netloc).strip(),
                    "url": url,
                    "domain": parsed.netloc,
                    "snippet": snippet,
                    "published_at": result.published_at,
                    "category": _source_category(str(result.title or ""), url, snippet),
                    "trial_specific": True,
                })

        collected.sort(key=_source_priority)

        dossier = {
            "nct_id": nct_id,
            "trial_title": str(title or "").strip()[:500],
            "provider": "Keenable",
            "researched_at": self.now().isoformat(),
            "sources": collected,
            "review_note": (
                "Public-web context only. Sources may be stale or incomplete and do not change the "
                "ClinicalTrials.gov match assessment; verify recruitment with the study site."
            ),
        }
        if self.cache:
            self.cache.set(cache_key, dossier)
        return dossier
