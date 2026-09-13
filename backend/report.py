# backend/main.py
"""
Generates a self-contained, printable HTML scan report for PDF export.

Provides report-specific styling and build_report_html(), which converts
summarized scan data into HTML for Playwright PDF rendering.

All scan-derived values are HTML-escaped before embedding, as they originate
from arbitrary websites.
"""

import html
from datetime import datetime, timezone

from tracker import extract_domain

REPORT_CSS = """
    * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    body {
        margin: 0;
        padding: 36px 40px;
        background: #FFFFFF;
        color: #1A1D24;
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 12px;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        border-bottom: 2px solid #1A1D24;
        padding-bottom: 14px;
        margin-bottom: 20px;
    }
    .brand {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.01em;
    }
    .brand span { color: #C9772E; }
    .meta {
        font-family: 'Courier New', monospace;
        font-size: 10px;
        color: #6B6F7A;
        text-align: right;
    }

    .title-block { margin-bottom: 22px; }
    .site-title {
        font-size: 22px;
        font-weight: 700;
        margin: 0 0 4px 0;
    }
    .site-final {
        font-family: 'Courier New', monospace;
        font-size: 10.5px;
        color: #6B6F7A;
    }

    .stats {
        display: flex;
        border: 1px solid #DADCE0;
        margin-bottom: 24px;
    }
    .stat {
        flex: 1;
        padding: 14px 16px;
        border-right: 1px solid #DADCE0;
    }
    .stat:last-child { border-right: none; }
    .stat-num {
        font-family: 'Courier New', monospace;
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 3px;
    }
    .stat-num.accent { color: #C9772E; }
    .stat-label { font-size: 10px; color: #6B6F7A; }

    .section-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6B6F7A;
        margin-bottom: 10px;
        font-weight: 700;
    }

    .breakdown { margin-bottom: 26px; }
    .bar {
        display: flex;
        height: 8px;
        width: 100%;
        border: 1px solid #DADCE0;
        overflow: hidden;
        margin-bottom: 10px;
    }
    .seg { height: 100%; }
    .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 18px;
        font-family: 'Courier New', monospace;
        font-size: 10px;
        color: #3C3F46;
    }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .legend-dot { width: 7px; height: 7px; flex-shrink: 0; border-radius: 1px; }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    th {
        text-align: left;
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #6B6F7A;
        border-bottom: 1.5px solid #1A1D24;
        padding: 6px 8px 6px 0;
        font-weight: 700;
    }
    td {
        padding: 7px 8px 7px 0;
        border-bottom: 1px solid #E9EAED;
        font-size: 11px;
        vertical-align: top;
    }
    .domain {
        font-family: 'Courier New', monospace;
        font-weight: 600;
    }
    .entity { color: #6B6F7A; font-size: 10px; margin-left: 6px; }
    .cat-cell { display: flex; align-items: center; gap: 6px; }
    .dot { width: 6px; height: 6px; border-radius: 1px; flex-shrink: 0; }
    .type-cell, .method-cell {
        font-family: 'Courier New', monospace;
        color: #6B6F7A;
        font-size: 10px;
    }
    tr.unclassified td { color: #9A9DA6; }

    .footnote {
        font-size: 10px;
        color: #6B6F7A;
        line-height: 1.6;
        border-top: 1px solid #DADCE0;
        padding-top: 12px;
    }
"""

CATEGORY_STYLE = {
    "Advertising": {"color": "#E08A3E", "label": "Advertising"},
    "Analytics": {"color": "#2E8B92", "label": "Analytics"},
    "Social": {"color": "#8B6BAD", "label": "Social"},
    "FingerprintingGeneral": {"color": "#B23A57", "label": "Fingerprinting (General)"},
    "FingerprintingInvasive": {"color": "#7A2438", "label": "Fingerprinting (Invasive)"},
    "Cryptomining": {"color": "#B5601F", "label": "Cryptomining"},
    "Content": {"color": "#4C9B6E", "label": "Content"},
    "Anti-fraud": {"color": "#2E6FA6", "label": "Anti-fraud"},
    "ConsentManagers": {"color": "#6E7C94", "label": "Consent Managers"},
    "Email": {"color": "#5B7FC4", "label": "Email"},
    "EmailAggressive": {"color": "#33509C", "label": "Email (Aggressive)"},
    "unclassified": {"color": "#B7BAC2", "label": "Unclassified"},
}
FALLBACK_STYLE = {"color": "#B7BAC2", "label": "Unknown"}


def get_category_style(category: str) -> dict:
    """Return category's corresponding styles."""
    return CATEGORY_STYLE.get(category, FALLBACK_STYLE)


def build_report_html(scan_data: dict) -> str:
    """Generate an HTML scan report."""
    url = html.escape(scan_data["url"])
    final_url = html.escape(scan_data.get("final_url") or scan_data["url"])
    requests = scan_data["network_requests"]
    category_counts = scan_data["category_counts"]
    total_requests = scan_data["network_requests_count"]
    tracker_count = scan_data["tracker_count"]
    third_party_count = scan_data["party_counts"].get("third-party", 0)
    entity_counts = scan_data.get("entity_counts", {})

    real_categories = [c for c in category_counts if c != "unclassified"]
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d, %H:%M UTC")

    # Breakdown bar segments + legend
    total = sum(category_counts.values()) or 1
    segs = []
    legend_items = []
    for category, count in sorted(category_counts.items(), key=lambda kv: -kv[1]):
        style = get_category_style(category)
        percent = (count / total) * 100
        segs.append(f'<div class="seg" style="width:{percent}%;background:{style["color"]};"></div>')
        legend_items.append(
            f'<div class="legend-item"><div class="legend-dot" style="background:{style["color"]};"></div>'
            f'{html.escape(style["label"])} {count}</div>'
        )

    # Table rows
    rows = []
    sorted_requests = sorted(requests, key=lambda r: r["classification"]["category"])
    for req in sorted_requests:
        category = req["classification"]["category"]
        style = get_category_style(category)
        entity = req["classification"].get("entity")
        domain = html.escape(extract_domain(req["url"]))
        entity_html = f'<span class="entity">{html.escape(entity)}</span>' if entity else ""
        row_class = "unclassified" if category == "unclassified" else ""

        rows.append(f"""
        <tr class="{row_class}">
            <td><span class="domain">{domain}</span>{entity_html}</td>
            <td><div class="cat-cell"><div class="dot" style="background:{style["color"]};"></div>{html.escape(style["label"])}</div></td>
            <td class="type-cell">{html.escape('First' if req['party'] == 'first-party' else 'Third')}</td>
            <td class="type-cell">{html.escape(req["resource_type"])}</td>
            <td class="method-cell">{html.escape(req["method"])}</td>
        </tr>""")

    # Entities table
    entity_rows = []
    for entity, counts in entity_counts.items():
        entity_rows.append(f"""
        <tr>
            <td>{html.escape(entity)}</td>
            <td class="type-cell">{counts["domains"]}</td>
            <td class="type-cell">{counts["requests"]}</td>
        </tr>""")

    return f"""
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><style>
        {REPORT_CSS}
        </style></head><body>
        <div class="header">
            <div class="brand"><span>&#9632;</span> glassweb — scan report</div>
            <div class="meta">generated {generated_at}</div>
        </div>
        <div class="title-block">
            <div class="site-title">{url}</div>
            <div class="site-final">redirected to {final_url}</div>
        </div>
        <div class="stats">
            <div class="stat"><div class="stat-num">{total_requests}</div><div class="stat-label">requests captured</div></div>
            <div class="stat"><div class="stat-num accent">{tracker_count}</div><div class="stat-label">matched to known trackers</div></div>
            <div class="stat"><div class="stat-num">{len(real_categories)}</div><div class="stat-label">categories present</div></div>
            <div class="stat"><div class="stat-num">{third_party_count}</div><div class="stat-label">third-party requests</div></div>
        </div>
        <div class="breakdown">
            <div class="section-title">Requests by category</div>
            <div class="bar">{''.join(segs)}</div>
            <div class="legend">{''.join(legend_items)}</div>
        </div>
        <div class="section-title">Captured requests</div>
        <table>
            <thead><tr><th>Domain</th><th>Category</th><th>Party</th><th>Type</th><th>Method</th></tr></thead>
            <tbody>{''.join(rows)}</tbody>
        </table>
        <div class="footnote">
            Unclassified means the domain isn't in the tracker dataset — not that it's confirmed safe.<br>
            Generated by Glassweb. Tracker classification data from Disconnect.me.
        </div>
        {"" if not entity_rows else f'''
            <div class="section-title">Requests by entity</div>
            <table>
                <thead><tr><th>Entity</th><th>Domains</th><th>Requests</th></tr></thead>
                <tbody>{''.join(entity_rows)}</tbody>
            </table>
        '''}
        </body></html>
        """
