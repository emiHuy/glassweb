// frontend/render.js
/**
 * @file Pure rendering layer for the Glassweb report view.
 *
 * Every exported function here takes already-resolved data as arguments and
 * produces DOM — nothing in this file reads or mutates application state
 * (scan data, active filters, sort order, etc.). That state lives entirely
 * in app.js, which is the only module allowed to import from here.
 *
 * Contract for anyone extending this file: if a function needs to know
 * *why* the data looks the way it does (which filters are active, what's
 * currently selected, what the sort order is), that's a sign the logic
 * belongs in app.js instead — compute it there and pass the result in.
 */

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
 * Populates the network request table, sorted alphabetically by tracker category.
 * @param {Array<Object>} networkRequests - List of captured HTTP requests.
 */
export function renderRequestTable(networkRequests) {
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
        row.className = 'req-row' + (isUnclassified ? ' unclassified' : '');

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
 * Displays an error message to the user.
 * @param {Error} err - The error object containing the message to display.
 */
export function renderError(err) {
    const detailEl = document.getElementById('error-detail');
    detailEl.textContent = err.message;
    detailEl.classList.remove('open');
}