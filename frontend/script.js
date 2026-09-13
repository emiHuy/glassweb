/**
 * Glassweb Frontend Application Script
 */

const BASE_URL = 'http://localhost:8000';

const STATE = { 
    SCANNING: 'is-scanning', 
    RESULTS: 'is-results', 
    ERROR: 'is-error'
};

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

const FILTER_GROUPS = {
    category: { selected: new Set(), labels: {} },
    party: { selected: new Set(), labels: { "first-party": "First-party", "third-party": "Third-party" } },
    method: { selected: new Set(), labels: {} },
    type: { selected: new Set(), labels: {} }
};

// Table sort state. Defaults to the original category sort for continuity.
let sortKey = 'classification.category';
let sortDir = 1;

let lastScanData = null;  // most recent successful scan's data

/**
 * Resolves metadata (color and label) for a given category key with fallback support.
 * @param {string} category - Category identifier.
 * @returns {Object} Category style/label mapping object.
 */
function getCategoryInfo(category) {
    return CATEGORY_INFO[category] || FALLBACK_CATEGORY;
}
    
/**
 * Toggles the visibility of the tracker information modal overlay.
 * @param {boolean} open - True to open the overlay, false to close it.
 */
function toggleInfo(open) {
    document.getElementById('info-overlay').classList.toggle('open', open);
}

// Event listeners for closing the info overlay
document.getElementById('info-close').addEventListener('click', () => toggleInfo(false));
document.getElementById('info-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'info-overlay') {
        toggleInfo(false);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        toggleInfo(false);
    } else if (e.key === 'Enter') {
        runScan();
    }
})

/**
 * Updates the UI layout state based on application flow (scanning, results, or error).
 * @param {string} state - One of STATE.SCANNING, STATE.RESULTS, or STATE.ERROR.
 */
function setState(state) {
    const container = document.getElementById('container');
    container.classList.remove(STATE.SCANNING, STATE.RESULTS, STATE.ERROR);
    
    if (state === STATE.SCANNING) {
        container.classList.add(STATE.SCANNING);
    } else if (state === STATE.RESULTS) {
        container.classList.add(STATE.RESULTS);
    } else if (state === STATE.ERROR) {
        container.classList.add(STATE.ERROR);
    }
}

/**
 * Normalizes user input into a fully qualified URL by adding a default protocol if missing.
 * @param {string} url - Raw URL input string.
 * @returns {string} Normalized URL string.
 */
function normalizeUrl(url) {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

/**
 * Initiates the network scan by fetching analytics data from the backend API.
 */
async function runScan() {
    const button = document.getElementById('scan-btn');
    const input = document.getElementById('url-input');
    const url = normalizeUrl(input.value);

    button.disabled = true;
    input.disabled = true;
    setState(STATE.SCANNING);

    try {
        const response = await fetch(`${BASE_URL}/scan?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Scan failed: ${response.status}`);
        }
        const data = await response.json();

        lastScanData = data;
        renderResults(data);
        setState(STATE.RESULTS);
    } catch (err) {
        renderError(err);
        setState(STATE.ERROR);
    }  finally {
        button.disabled = false;
        input.disabled = false;
    }
}

/**
 * Populates the network request table, sorted alphabetically by tracker category.
 * @param {Array<Object>} networkRequests - List of captured HTTP requests.
 */
function renderRequestTable(networkRequests) {
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
function renderEntitySummary(entityCounts) {
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
 * Derives available filter options from the current scan's requests.
 * Category/method/type are data-driven since they vary per scan;
 * party/tracker are always both possible values regardless of data.
 * @param {Array<Object>} requests - The full, unfiltered scan's requests.
 * @returns {Object} Map of group name -> array of available values.
 */
function buildFilterOptions(requests) {
    const categories = new Set();
    const methods = new Set();
    const types = new Set();
 
    requests.forEach(req => {
        categories.add(req.classification.category);
        methods.add(req.method);
        types.add(req.resource_type);
    });
 
    return {
        category: [...categories],
        party: ["first-party", "third-party"],
        method: [...methods],
        type: [...types]
    };
}

/**
 * Rebuilds each filter dropdown's checklist based on the current scan's data,
 * and resets all filter selections. Called once per successful scan.
 * @param {Array<Object>} requests - The full, unfiltered scan's requests.
 */
function buildFilterPanels(requests) {
    const options = buildFilterOptions(requests);
 
    Object.keys(FILTER_GROUPS).forEach(groupKey => {
        const group = FILTER_GROUPS[groupKey];
        group.selected = new Set(options[groupKey]);
 
        const panel = document.querySelector(`[data-panel="${groupKey}"]`);
        panel.innerHTML = '';
 
        options[groupKey].forEach(val => {
            const item = document.createElement('label');
            item.className = 'filter-item';
 
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = val;
            cb.checked = true;
            cb.addEventListener('change', () => {
                if (cb.checked) group.selected.add(val); else group.selected.delete(val);
                updateFilterButtonLabel(groupKey);
                applyFiltersAndRender();
            });
 
            const label = document.createElement('span');
            label.textContent = group.labels[val] || (val === 'unclassified' ? 'Unclassified' : val);
 
            item.append(cb, label);
            panel.appendChild(item);
        });
 
        updateFilterButtonLabel(groupKey);
    });
}

/**
 * Updates a filter dropdown button's label to show a selection count badge
 * when that group has active filters.
 * @param {string} groupKey - One of the FILTER_GROUPS keys.
 */
function updateFilterButtonLabel(groupKey) {
    const group = FILTER_GROUPS[groupKey];
    const btn = document.querySelector(`[data-toggle="${groupKey}"]`);
    const base = { category: 'Category', party: 'Party', method: 'Method', type: 'Type' }[groupKey];
    const totalOptions = document.querySelectorAll(`[data-panel="${groupKey}"] input[type="checkbox"]`).length;
 
    btn.innerHTML = '';
    btn.append(base);
    if (group.selected.size < totalOptions) {
        const count = document.createElement('span');
        count.className = 'n';
        count.textContent = ` ${group.selected.size}`;
        btn.appendChild(count);
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}

/**
 * Opens the given filter group's dropdown panel, closing any others.
 * @param {string} groupKey - One of the FILTER_GROUPS keys.
 */
function toggleFilterPanel(groupKey) {
    document.querySelectorAll('.filter-dd-panel').forEach(p => {
        if (p.getAttribute('data-panel') !== groupKey) p.classList.remove('open');
    });
    document.querySelector(`[data-panel="${groupKey}"]`).classList.toggle('open');
}

/**
 * Reads a possibly-nested field off a request object, e.g. "classification.category".
 * @param {Object} req - A network request object.
 * @param {string} key - Dot-delimited field path.
 * @returns {*} The resolved value, or undefined if any segment is missing.
 */
function getSortValue(req, key) {
    return key.split('.').reduce((obj, k) => obj?.[k], req);
}

/**
 * Sorts a request array by the current sortKey/sortDir, without mutating the input.
 * @param {Array<Object>} requests - Requests to sort.
 * @returns {Array<Object>} A new, sorted array.
 */
function applySort(requests) {
    return [...requests].sort((a, b) => {
        const av = getSortValue(a, sortKey) ?? '';
        const bv = getSortValue(b, sortKey) ?? '';
        return String(av).localeCompare(String(bv)) * sortDir;
    });
}

/**
 * Filters lastScanData's requests against all active filter groups + search,
 * applies the current sort, and re-renders the table. Stats and the category
 * breakdown always reflect the full, unfiltered scan and are not affected.
 */
function applyFiltersAndRender() {
    if (!lastScanData) return;
 
    const search = document.getElementById('filter-search').value.toLowerCase();
    const { category, party, method, type } = FILTER_GROUPS;
 
    let filtered = lastScanData.network_requests.filter(req => {
        const domain = new URL(req.url).hostname.toLowerCase();
        const entity = (req.classification.entity || '').toLowerCase();
        if (search && !domain.includes(search) && !entity.includes(search)) return false;
        if (!category.selected.has(req.classification.category)) return false;
        if (!party.selected.has(req.party)) return false;
        if (!method.selected.has(req.method)) return false;
        if (!type.selected.has(req.resource_type)) return false;
        return true;
    });
 
    filtered = applySort(filtered);
    renderRequestTable(filtered);
}

/**
 * Renders all components of the analysis results report using API response data.
 * @param {Object} data - The complete scan results payload from the backend.
 */
function renderResults(data) {
    /**
     * Renders the base scanned domain and redirect URL details.
     * @param {string} scannedUrl - The initially requested URL.
     * @param {string} finalUrl - The final redirected URL, if any.
     */
    function renderUrls(scannedUrl, finalUrl) {
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
    function renderStats() {
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
    function renderBreakdown(categoryCounts) {
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

    // Execute all sub-rendering pipelines
    renderUrls(data.url, data.final_url);
    buildFilterPanels(data.network_requests);
    sortKey = 'classification.category';
    sortDir = 1;
    applyFiltersAndRender();
    renderStats();
    renderBreakdown(data.category_counts);
    renderEntitySummary(data.entity_counts);
}

/**
 * Displays an error message to the user.
 * @param {Error} err - The error object containing the message to display.
 */
function renderError(err) {
    const detailEl = document.getElementById('error-detail');
    detailEl.textContent = err.message;
    detailEl.classList.remove('open');
}

/**
 * Triggers a browser download of the last scan data as a formatted JSON file.
 * The filename includes the current date (YYYY-MM-DD).
 */
function exportJSON() {
    if (!lastScanData) {
        return;
    }

    const blob = new Blob([JSON.stringify(lastScanData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `glassweb-scan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

/**
 * Requests a PDF export of the latest scan data, creates a temporary local object URL,
 * and triggers an automatic file download in the browser.
 *
 * Sends a POST request with the cached scan data, converts the resulting PDF stream 
 * into a Blob, and programmatically clicks an anchor element to start the download.
 *
 * @async
 * @function exportPDF
 * @returns {Promise<void>} Resolves when the download sequence is complete, or 
 *     returns early if no scan data is currently cached.
 * @throws {Error} Throws an error if the network response is not OK; caught locally 
 *     to render the error and update the application state.
 */
async function exportPDF() {
    if (!lastScanData) {
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/export/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lastScanData)
        });
        if (!response.ok) {
            throw new Error(`PDF export failed: ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `glassweb-scan-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();

        URL.revokeObjectURL(url);
    } catch (err) {
        renderError(err);
        setState(STATE.ERROR);
    }
}

// --- Filter bar wiring ---
document.getElementById('filter-search').addEventListener('input', applyFiltersAndRender);
document.getElementById('filter-clear-btn').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    buildFilterPanels(lastScanData.network_requests);
    sortKey = 'classification.category';
    sortDir = 1;
    applyFiltersAndRender();
});
document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFilterPanel(btn.getAttribute('data-toggle'));
    });
});
document.addEventListener('click', () => {
    document.querySelectorAll('.filter-panel').forEach(p => p.classList.remove('open'));
});
document.getElementById('filter-bar').addEventListener('click', (e) => e.stopPropagation());
 
document.getElementById('req-table').addEventListener('click', (e) => {
    const key = e.target.closest('[data-sort]')?.getAttribute('data-sort');
    if (!key) return;
    if (sortKey === key) { sortDir *= -1; } else { sortKey = key; sortDir = 1; }
    applyFiltersAndRender();
});

// Global UI trigger bindings
document.getElementById('info-btn').addEventListener('click', () => toggleInfo(true));
document.getElementById('scan-btn').addEventListener('click', runScan);
document.getElementById('error-detail-toggle').addEventListener('click', () => {
    document.getElementById('error-detail').classList.toggle('open');
});
document.getElementById('export-json').addEventListener('click', exportJSON);
document.getElementById('export-pdf').addEventListener('click', exportPDF);