import json
from pathlib import Path

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
