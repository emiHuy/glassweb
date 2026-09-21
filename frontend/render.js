// frontend/render.js

/**
 * @file Pure rendering layer for the Glassweb report view.
 * Exported functions take resolved data and produce DOM only.
 * */

const CATEGORY_INFO = {
    "Advertising": { color: "var(--cat-advertising)", label: "Advertising" },
    "Analytics": { color: "var(--cat-analytics)", label: "Analytics" },
    "Anti-fraud": { color: "var(--cat-anti-fraud)", label: "Anti-fraud" },
    "ConsentManagers": { color: "var(--cat-consent-managers)", label: "Consent Managers" },
    "Content": { color: "var(--cat-content)", label: "Content" },
    "Cryptomining": { color: "var(--cat-cryptomining)", label: "Cryptomining" },
    "Email": { color: "var(--cat-email)", label: "Email" },
    "EmailAggressive": { color: "var(--cat-email-aggressive)", label: "Email (Aggressive)" },
    "FingerprintingGeneral": { color: "var(--cat-fingerprinting-general)", label: "Fingerprinting (General)" },
    "FingerprintingInvasive": { color: "var(--cat-fingerprinting-invasive)", label: "Fingerprinting (Invasive)" },
    "Social": { color: "var(--cat-social)", label: "Social" },
    "unclassified": { color: "var(--cat-unclassified)", label: "Unclassified" }
}
const FALLBACK_CATEGORY = { color: "var(--cat-unclassified)", label: "Unknown" }

/**
 * Resolves metadata (color and label) for a given category key with fallback support.
 * @param {string} category - Category identifier.
 * @returns {Object} Category style/label mapping object.
 */
function getCategoryInfo(category) {
    return CATEGORY_INFO[category] || FALLBACK_CATEGORY;
}

/**
 * Renders the base scanned domain and redirect URL details.
 * @param {string} scannedUrl - The initially requested URL.
 * @param {string} finalUrl - The final redirected URL, if any.
 */
export function renderUrls(scannedUrl, finalUrl) {
    document.getElementById('report-url-base').textContent = scannedUrl;

    const finalEl = document.getElementById('report-url-final');

    if (finalUrl && finalUrl !== scannedUrl) {
        finalEl.textContent = `→ ${finalUrl}`;
        finalEl.style.display = '';
    } else {
        finalEl.style.display = 'none';
    }
}

/**
 * Updates header metrics displaying total requests, trackers, and active categories.
 */
export function renderStats(data) {
    document.getElementById('stat-requests').textContent = data.network_requests_count;
    document.getElementById('stat-trackers').textContent = data.tracker_count;

    const realCategories = Object.keys(data.category_counts).filter(cat => cat !== "unclassified");
    document.getElementById('stat-categories').textContent = realCategories.length;

    document.getElementById('stat-third-party').textContent = data.party_counts["third-party"] || 0;
}

/**
 * Renders the proportional multi-segment breakdown bar and legend items.
 * @param {Object} categoryCounts - Dictionary of category counts.
 */
export function renderBreakdown(categoryCounts) {
    const segBar = document.getElementById('seg-bar');
    const legend = document.getElementById('legend');
    
    segBar.innerHTML = '';
    legend.innerHTML = '';

    const total = Object.values(categoryCounts).reduce((sum, n) => sum + n, 0);

    const entries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

    for (const [category, count] of entries) {
        const { color, label } = getCategoryInfo(category);
        const percent = total > 0 ? (count / total) * 100 : 0;

        const seg = document.createElement('div');
        seg.className = 'seg';
        seg.style.width = `${percent}%`;
        seg.style.background = color;
        segBar.appendChild(seg);

        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<div class="legend-dot" style="background: ${color};"></div>${label} <span class="legend-count">${count}</span>`;
        legend.appendChild(item);
    }
}

/**
 * Draws the checkbox list for one filter dropdown panel. Pure DOM: takes the
 * available options, which are currently selected, and a callback to notify
 * on toggle — has no idea what "selected" means or how it changes.
 * @param {string} groupKey - One of "category" | "party" | "method" | "type".
 * @param {Array<string>} options - Available values for this group in the current scan.
 * @param {Set<string>} selectedSet - Currently selected values for this group.
 * @param {Object} labels - Optional display-label overrides, keyed by value.
 * @param {(val: string, checked: boolean) => void} onToggle - Called when a checkbox changes.
 */
export function renderFilterOptions(groupKey, options, selectedSet, labels, onToggle) {
  const panel = document.querySelector(`[data-panel="${groupKey}"]`);
  panel.innerHTML = '';

  options.forEach(val => {
    const item = document.createElement('label');
    item.className = 'filter-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = val;
    cb.checked = selectedSet.has(val);
    cb.addEventListener('change', () => onToggle(val, cb.checked));

    const label = document.createElement('span');
    label.textContent = labels[val] || (val === 'unclassified' ? 'Unclassified' : val);

    item.append(cb, label);
    panel.appendChild(item);
  });
}

/**
 * Formats a request's raw POST body for display. 
 * Possible post data formats: no body, "[binary data, N bytes]", text
 * @param {string|null} raw - req.post_data as sent by the backend.
 * @returns {string} Text ready to drop into the panel.
 */
function formatPostData(raw) {
    if (raw.startsWith('[binary data')) {
        return raw;
    }
    
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        return raw;
    }
}

/**
 * Highlights flagged query-param name=value pairs within a URL string as
 * inline HTML.
 * @param {string} urlStr - The full request URL.
 * @param {Array<string>} flaggedParams - Param names already identified as tracking params.
 * @returns {string} HTML string with flagged params wrapped in a highlight span.
 */
function highlightUrl(urlStr, flaggedParams) {
    if (flaggedParams.length === 0) return urlStr;
    let out = urlStr;
    flaggedParams.forEach(p => {
        const re = new RegExp(`(${p}=[^&]*)`, 'g');
        out = out.replace(re, '§§$1§§');
    });
    return out.split('§§').map((seg, i) =>
        i % 2 === 1 ? `<span class="param-flag">${seg}</span>` : seg
    ).join('');
}

/**
 * Fills and opens the request detail side panel for a single request.
 * @param {Object} req - The request to display.
 */
export function renderRequestDetail(req) {
    const { color, label } = getCategoryInfo(req.classification.category);
    const domain = new URL(req.url).hostname;
 
    document.getElementById('detail-accent').style.background = color;
    document.getElementById('detail-domain').textContent = domain;
    document.getElementById('detail-entity').textContent = req.classification.entity || 'No known entity';
 
    document.getElementById('detail-badges').innerHTML = `
        <div class="badge ${req.party === 'third-party' ? 'third-party' : ''}">${req.party}</div>
        <div class="badge"><div class="dot" style="background:${color};"></div>${label}</div>
    `;
 
    document.getElementById('method-val').textContent = req.method;
    document.getElementById('type-val').textContent = req.resource_type;
    document.getElementById('party-val').textContent = req.party === 'first-party' ? 'First-party' : 'Third-party';
    document.getElementById('url-val').innerHTML = highlightUrl(req.url, req.tracking_params);
    document.getElementById('category-val').textContent = label;
    document.getElementById('entity-val').textContent = req.classification.entity || '—';
 
    const signalsEl = document.getElementById('signals');
    signalsEl.innerHTML = req.tracking_params.length > 0
        ? `<div class="signal-row">
             <div class="signal-icon flagged">!</div>
             <div class="signal-text">
               <b>${req.tracking_params.length} tracking parameter${req.tracking_params.length > 1 ? 's' : ''} in URL</b>
               <div class="sub">${req.tracking_params.join(', ')} — identifies you or your session to this domain</div>
             </div>
           </div>`
        : `<div class="signal-row">
             <div class="signal-icon clear">&#10003;</div>
             <div class="signal-text">
               <b>No tracking parameters detected</b>
               <div class="sub">URL doesn't carry any known tracking IDs</div>
             </div>
           </div>`;
 
    const postDataSection = document.getElementById('post-data-section');
    const postDataEl = document.getElementById('post-data');
    if (req.post_data) {
        postDataSection.style.display = '';
        postDataEl.textContent = formatPostData(req.post_data);
    } else {
        postDataSection.style.display = 'none';
    }

    document.getElementById('scrim').classList.add('open');
    document.getElementById('detail-panel').classList.add('open');
}

/**
 * Closes the request detail panel.
 */
export function closeRequestDetail() {
    document.getElementById('scrim').classList.remove('open');
    document.getElementById('detail-panel').classList.remove('open');
}
 
/**
 * Populates the network request table, sorted alphabetically by tracker category.
 * @param {Array<Object>} networkRequests - List of captured HTTP requests.
 */
export function renderRequestTable(networkRequests, onRowClick, selectedRequest) {
    const table = document.getElementById('req-table');
    
    // Clear existing rows except the table header
    table.querySelectorAll('.req-row:not(.head)').forEach(row => row.remove());
    
    for (const req of networkRequests) {
        const { color, label } = getCategoryInfo(req.classification.category);
        const isUnclassified = req.classification.category === "unclassified";
        const domain = new URL(req.url).hostname;
        const entity = req.classification.entity;
        const partyLabel = req.party === "first-party" ? "First" : "Third";

        const row = document.createElement('div');
        row.className = 'req-row' 
            + (isUnclassified ? ' unclassified' : '')
            + (req === selectedRequest ? ' selected' : '');
        row.addEventListener('click', () => onRowClick(req));

        const accent = document.createElement('div');
        accent.className = 'req-accent';
        accent.style.background = color;

        const domainEl = document.createElement('div');
        domainEl.className = 'req-domain';
        domainEl.textContent = domain;
        if (entity) {
            const entitySpan = document.createElement('span');
            entitySpan.className = 'entity';
            entitySpan.textContent = ` ${entity}`;
            domainEl.appendChild(entitySpan);
        }

        const categoryEl = document.createElement('div');
        categoryEl.className = 'req-category';
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.background = color;
        categoryEl.appendChild(dot);
        categoryEl.append(label); // text node, safe

        const partyEl = document.createElement('div');
        partyEl.className = 'req-party';
        partyEl.textContent = partyLabel;

        const typeEl = document.createElement('div');
        typeEl.className = 'req-type';
        typeEl.textContent = req.resource_type;

        const methodEl = document.createElement('div');
        methodEl.className = 'req-method';
        methodEl.textContent = req.method;

        row.append(accent, domainEl, categoryEl, partyEl, typeEl, methodEl);
        table.appendChild(row);
    }
}

/**
 * Renders a table of tracker entities by reach (domain and request counts),
 * in the order provided by the backend (pre-sorted by request count,
 * descending). Hides the section entirely if empty.
 * @param {Object} entityCounts - Map of entity name -> {domains, requests}.
 */
export function renderEntitySummary(entityCounts) {
    const table = document.getElementById('entity-table');

    // Clear existing rows except the header
    table.querySelectorAll('.entity-row:not(.head)').forEach(row => row.remove());

    const entries = Object.entries(entityCounts);

    if (entries.length === 0) {
        table.style.display = 'none';
        return;
    }
    table.style.display = '';

    for (const [entity, { domains, requests }] of entries) {
        const row = document.createElement('div');
        row.className = 'entity-row';

        const nameEl = document.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = entity;

        const domainsEl = document.createElement('div');
        domainsEl.className = 'count';
        domainsEl.textContent = domains;

        const requestsEl = document.createElement('div');
        requestsEl.className = 'count';
        requestsEl.textContent = requests;

        row.append(nameEl, domainsEl, requestsEl);
        table.appendChild(row);
    }
}

/**
 * Displays an error message to the user.
 * @param {Error} err - The error object containing the message to display.
 */
export function renderError(err) {
    const detailEl = document.getElementById('error-detail');
    detailEl.textContent = err.message;
    detailEl.classList.remove('open');
}