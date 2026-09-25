# backend/tracker.py
"""
Utilities for classifying network requests using the Disconnect.me tracker
dataset and summarizing scan results.

Provides helpers for loading tracker data, extracting and matching hostnames,
classifying first-/third-party requests, and aggregating results by tracker
status, category, party, and entity.
"""

import json
from pathlib import Path
from urllib.parse import urlparse

import tldextract

DATA_PATH = Path(__file__).parent / "data" / "services.json"
UNCLASSIFIED = {"entity": None, "category": "unclassified"}

_extract = tldextract.TLDExtract(suffix_list_urls=())


def load_tracker_data() -> dict:
    """Load and flatten tracker mapping data from a JSON file."""
    tracker_map = {}

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Flatten data into a map: domain -> {entity, category}
    for category_name, entity_list in data["categories"].items():
        for entity_entry in entity_list:
            entity_name = list(entity_entry.keys())[0]
            url_to_domains = entity_entry[entity_name]

            for _, value in url_to_domains.items():
                # Skip non-list metadata (e.g. "performance": "true")
                if not isinstance(value, list):
                    continue

                for domain in value:
                    tracker_map[domain] = {"entity": entity_name, "category": category_name}

    return tracker_map


def extract_domain(url: str) -> str:
    """Extract the network location (domain) from a given URL string."""
    return urlparse(url).netloc


def match_domain(hostname: str, tracker_map: dict) -> dict | None:
    """Check if a hostname matches a known tracker, supporting wildcard subdomains."""
    parts = hostname.split(".")
    for i in range(len(parts)):
        candidate = ".".join(parts[i:])
        if candidate in tracker_map:
            return tracker_map[candidate]
    return None


def classify_party(scanned_url: str, request_url: str) -> str:
    """Returns 'first-party' or 'third-party' based on registrable domain comparison."""
    scanned_domain = _extract(scanned_url).registered_domain
    request_domain = _extract(request_url).registered_domain
    return "first-party" if scanned_domain == request_domain else "third-party"


def summarize_entities(network_requests: list) -> dict:
    """Aggregate request and domain counts per known tracker entity. Exclude requests with no entity (unclassified)"""
    entities = {}

    for req in network_requests:
        entity = req["classification"].get("entity")
        if not entity:
            continue

        e = entities.setdefault(entity, {
            "domains": set(),
            "requests": 0,
            "get_count": 0,
            "post_count": 0,
            "categories": set()
        })
        e["domains"].add(extract_domain(req["url"]))
        e["requests"] += 1

        if req["method"] == "GET":
            e["get_count"] += 1
        elif req["method"] == "POST":
            e["post_count"] += 1

        if req["classification"]["category"] != UNCLASSIFIED["category"]: 
            e["categories"].add(req["classification"]["category"])

    summary = {}
    for name, v in entities.items():
        summary[name] = {
            "domains": len(v["domains"]),
            "requests": v["requests"],
            "get": v["get_count"],
            "post": v["post_count"],
            "categories": v["categories"]
        }

    return dict(sorted(summary.items(), key=lambda item: item[1]["requests"], reverse=True))


def summarize_requests(network_requests: list) -> dict:
    """Summarize tracker activity across a list of network requests."""
    # Counts trackers
    tracker_count = 0
    for req in network_requests:
        if req["classification"]["category"] != UNCLASSIFIED["category"]:
            tracker_count += 1

    # Counts trackers found in each category
    category_counts = {}
    for req in network_requests:
        category = req["classification"]["category"]
        category_counts[category] = category_counts.get(category, 0) + 1

    # Counts requests by first-party / third-party
    party_counts = {}
    for req in network_requests:
        party = req["party"]
        party_counts[party] = party_counts.get(party, 0) + 1

    entity_counts = summarize_entities(network_requests)
    
    return {
        "tracker_count": tracker_count,
        "category_counts": category_counts,
        "party_counts": party_counts,
        "entity_counts": entity_counts,
    }