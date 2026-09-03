"""
Tracker classification helpers: loads the Disconnect.me dataset, extracts/matches domains against it, 
and summarizes results.
"""

import json
from pathlib import Path
from urllib.parse import urlparse

DATA_PATH = Path(__file__).parent / "data" / "services.json"
UNCLASSIFIED = {"entity": None, "category": "unclassified"}

def load_tracker_data() -> dict:
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
    return urlparse(url).netloc

def match_domain(hostname: str, tracker_map: dict) -> dict | None:
    # Checks if resource matches a known tracker.
    # Tries full hostname, then strips subdomains until a match or nothing left
    parts = hostname.split(".")
    for i in range(len(parts)):
        candidate = ".".join(parts[i:])
        if candidate in tracker_map:
            return tracker_map[candidate]
    return None

def summarize_requests(network_requests: list) -> dict:
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

    return {
        "tracker_count": tracker_count,
        "category_counts": category_counts
    }