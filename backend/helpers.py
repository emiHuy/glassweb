import json
from pathlib import Path
from urllib.parse import urlparse

DATA_PATH = Path(__file__).parent / "data" / "services.json"

def load_tracker_data():
    services_map = {}

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    for category_name, entity_list in data["categories"].items():
        for entity_entry in entity_list:
            entity_name = list(entity_entry.keys())[0]
            url_to_domains = entity_entry[entity_name]

            for _, value in url_to_domains.items():
                if not isinstance(value, list):
                    continue
                for domain in value:
                    services_map[domain] = {"entity": entity_name, "category": category_name}

    return services_map

def extract_domain(url):
    return urlparse(url).netloc

def match_domain(hostname, tracker_map):
    parts = hostname.split(".")
    for i in range(len(parts)):
        candidate = ".".join(parts[i:])
        if candidate in tracker_map:
            return tracker_map[candidate]
    return None

def summarize_requests(network_requests):
    tracker_count = 0
    for req in network_requests:
        if req["classification"]["category"] != "unclassified":
            tracker_count += 1

    category_counts = {}
    for req in network_requests:
        category = req["classification"]["category"]
        category_counts[category] = category_counts.get(category, 0) + 1

    return {
        "tracker_count": tracker_count,
        "category_counts": category_counts
    }