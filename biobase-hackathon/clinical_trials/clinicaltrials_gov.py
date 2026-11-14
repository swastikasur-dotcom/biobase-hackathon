"""Small official ClinicalTrials.gov API v2 client.

Network retrieval is isolated here so callers can replace this client in tests,
or later cache results in a database, without changing matching or UI code.
"""

import json
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import urlopen

from .models import PatientProfile, TrialRecord


BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
OPEN_FOR_ENROLLMENT = ("RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION")


def _default_get(url):
    with urlopen(url, timeout=15) as response:  # nosec B310: fixed HTTPS API endpoint
        return json.load(response)


class ClinicalTrialsGovClient:
    def __init__(self, get_json: Optional[Callable] = None, base_url=BASE_URL, cache=None, now=None):
        self._get_json = get_json or _default_get
        self._base_url = base_url
        self._cache = cache
        self._now = now or (lambda: datetime.now(timezone.utc))

    def search_open_trials(self, profile: PatientProfile, page_size=20):
        """Find open studies using only a de-identified disease query.

        This is discovery, not an eligibility decision. The response is normalized
        before it crosses the package boundary.
        """
        if not 1 <= page_size <= 100:
            raise ValueError("page_size must be from 1 to 100")
        params = {
            "query.cond": profile.search_condition(),
            "filter.overallStatus": "|".join(OPEN_FOR_ENROLLMENT),
            "pageSize": page_size,
            "format": "json",
        }
        url = self._base_url + "?" + urlencode(params)
        cached = self._cache.get(url) if self._cache else None
        if cached is None:
            retrieved_at = self._now().isoformat()
            payload = self._get_json(url)
            cached = (payload, retrieved_at)
            if self._cache:
                self._cache.set(url, cached)
        payload, retrieved_at = cached
        return [normalize_study(study, retrieved_at=retrieved_at) for study in payload.get("studies", [])]


def normalize_study(study: Dict, retrieved_at=None) -> TrialRecord:
    """Map the API's nested schema to the small stable UI contract."""
    protocol = study.get("protocolSection", {})
    identification = protocol.get("identificationModule", {})
    status = protocol.get("statusModule", {})
    conditions = protocol.get("conditionsModule", {})
    design = protocol.get("designModule", {})
    eligibility = protocol.get("eligibilityModule", {})
    contacts = protocol.get("contactsLocationsModule", {})
    interventions = [item.get("name", "") for item in design.get("interventions", []) if item.get("name")]
    locations = []
    for location in contacts.get("locations", []):
        normalized = {
            "facility": location.get("facility", ""),
            "city": location.get("city", ""),
            "state": location.get("state", ""),
            "country": location.get("country", ""),
            "zip": location.get("zip", ""),
        }
        geo = location.get("geoPoint") or {}
        if geo.get("lat") is not None and geo.get("lon") is not None:
            normalized["latitude"] = geo["lat"]
            normalized["longitude"] = geo["lon"]
        locations.append(normalized)
    nct_id = identification.get("nctId", "")
    return TrialRecord(
        nct_id=nct_id,
        title=identification.get("briefTitle") or identification.get("officialTitle") or nct_id,
        status=status.get("overallStatus", "UNKNOWN"),
        conditions=list(conditions.get("conditions", [])),
        interventions=interventions,
        eligibility_text=eligibility.get("eligibilityCriteria"),
        sexes_eligible=eligibility.get("sex"),
        minimum_age=eligibility.get("minimumAge"),
        maximum_age=eligibility.get("maximumAge"),
        locations=locations,
        official_url="https://clinicaltrials.gov/study/" + nct_id if nct_id else None,
        retrieved_at=retrieved_at,
        last_update_posted=(status.get("studyLastUpdatePostDateStruct") or {}).get("date"),
    )
