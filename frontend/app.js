// frontend/app.js

/**
 * @file Application controller for Glassweb's frontend.
 * 
 * Owns application state, backend calls, UI state, and DOM event wiring.
 */

import {
    renderFilterOptions,
    renderRequestTable,
    renderRequestDetail,
    closeRequestDetail,
    renderUrls,
    renderStats,
    renderBreakdown,
    renderEntitySummary,
    renderError,
    renderRestoreError,
    clearRestoreError
} from './render.js';

const BASE_URL = 'http://localhost:8000';

const STATE = { 
    SCANNING: 'is-scanning', 
    RESULTS: 'is-results', 
    ERROR: 'is-error'
};

const FILTER_GROUPS = {
    category: { selected: new Set(), labels: {} },
    party: { selected: new Set(), labels: { "first-party": "First-party", "third-party": "Third-party" } },
    method: { selected: new Set(), labels: {} },
    type: { selected: new Set(), labels: {} }
};

// Fields a restored file must have to be treated as a real glassweb scan
// export, rather than some arbitrary JSON someone happened to drop.
const REQUIRED_SCAN_FIELDS = ['url', 'network_requests', 'category_counts', 'party_counts', 'network_requests_count', 'tracker_count'];

// Table sort state. Defaults to the original category sort for continuity.
let sortKey = 'classification.category';
let sortDir = 1;

let lastScanData = null;       // most recent successful scan's data
let selectedRequest = null; // url of the request currently open in the detail panel, if any

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
 * Derives available filter options from the current scan's requests.
 * Category/method/type are data-driven since they vary per scan;
 * party/tracker are always both possible values regardless of data.
 * @param {Array<Object>} requests - The full, unfiltered scan's requests.
 * @returns {Object} Map of group name -> array of available values.
 */
function computeFilterOptions(requests) {
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
 * and resets all filter selections to "everything selected". Called once per
 * successful scan.
 * @param {Array<Object>} requests - The full, unfiltered scan's requests.
 */
function buildFilterPanels(requests) {
    const options = computeFilterOptions(requests);
    Object.keys(FILTER_GROUPS).forEach(groupKey => {
        const group = FILTER_GROUPS[groupKey];
        group.selected = new Set(options[groupKey]);
        renderFilterOptions(groupKey, options[groupKey], group.selected, group.labels,
            (val, checked) => {
                checked ? group.selected.add(val) : group.selected.delete(val);
                updateFilterButtonLabel(groupKey);
                applyFiltersAndRender();
            });
        updateFilterButtonLabel(groupKey);
    });
}

/**
 * Filters lastScanData's requests against the active search text and all
 * four filter groups (category, party, method, type), then sorts the
 * result by the current sortKey/sortDir.
 * @returns {Array<Object>} The visible, sorted requests. Empty if no scan
 *   has completed yet.
 */
function getVisibleRequests() {
    if (!lastScanData) return [];
    const search = document.getElementById('filter-search').value.toLowerCase();
    const { category, party, method, type } = FILTER_GROUPS;

    const filtered = lastScanData.network_requests.filter(req => {
        const domain = new URL(req.url).hostname.toLowerCase();
        const entity = (req.classification.entity || '').toLowerCase();
        if (search && !domain.includes(search) && !entity.includes(search)) {
            return false;
        }
        return (
            category.selected.has(req.classification.category)
            && party.selected.has(req.party)
            && method.selected.has(req.method)
            && type.selected.has(req.resource_type)
        );
    });

    return [...filtered].sort((a, b) => {
        const av = sortKey.split('.').reduce((o, k) => o?.[k], a) ?? '';
        const bv = sortKey.split('.').reduce((o, k) => o?.[k], b) ?? '';
        return String(av).localeCompare(String(bv)) * sortDir;
    });
}

/**
 * Opens the detail panel for a clicked request and re-renders the table so
 * that row picks up the "selected" highlight.
 * @param {Object} req - The clicked request's data.
 */
function openRequestDetail(req) {
    selectedRequest = req;
    renderRequestDetail(req);
    applyFiltersAndRender();
}
 
/**
 * Closes the detail panel and clears the row highlight.
 */
function closeRequestDetailPanel() {
    selectedRequest = null;
    closeRequestDetail();
    applyFiltersAndRender();
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
    document.querySelectorAll('.filter-panel').forEach(p => {
        if (p.getAttribute('data-panel') !== groupKey) p.classList.remove('open');
    });
    document.querySelector(`[data-panel="${groupKey}"]`).classList.toggle('open');
}

/**
 * Recomputes the visible request set and re-renders just the table.
 * Stats and the category breakdown always reflect the full, unfiltered
 * scan and are not affected by filtering/sorting.
 */
function applyFiltersAndRender() {
    renderRequestTable(getVisibleRequests(), openRequestDetail, selectedRequest);
}

/**
 * Renders all components of the analysis results report using API response data.
 * Resets filter/sort state to defaults for the new scan, then draws everything.
 * @param {Object} data - The complete scan results payload from the backend.
 */
function renderResults(data) {
    renderUrls(data.url, data.final_url);
    renderStats(data);
    renderBreakdown(data.category_counts);
    renderEntitySummary(data.entity_counts);

    buildFilterPanels(data.network_requests);
    sortKey = 'classification.category';
    sortDir = 1;
    applyFiltersAndRender();
}

/**
 * Toggles the visibility of the tracker information modal overlay.
 * @param {boolean} open - True to open the overlay, false to close it.
 */
function toggleInfo(open) {
    document.getElementById('info-overlay').classList.toggle('open', open);
}

/**
 * Checks that a parsed JSON object has the shape of a real glassweb scan
 * export, not just any JSON file someone happened to drop.
 * @param {*} data - The parsed JSON.
 * @returns {string|null} A description of what's wrong, or null if valid.
 */
function validateScanShape(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return 'File does not contain a JSON object.';
    }
    const missing = REQUIRED_SCAN_FIELDS.filter(f => !(f in data));
    if (missing.length > 0) {
        return `Missing expected field(s): ${missing.join(', ')}`;
    }
    if (!Array.isArray(data.network_requests)) {
        return '"network_requests" is not a list.';
    }
    return null;
}

/**
 * Reads, validates, and renders a previously-exported scan.json file.
 * @param {File} file - The selected or dropped file.
 */
function handleRestoreFile(file) {
    if (!file) {
        return;
    }
    clearRestoreError();
 
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        renderRestoreError(
            'Restore only works with a scan.json file previously downloaded from Glassweb\'s "Save as JSON" button.',
            `Selected file: ${file.name} (${file.type || 'unknown type'})`
        );
        return;
    }
 
    const reader = new FileReader();
    reader.onload = (e) => {
        let data;
        try {
            data = JSON.parse(e.target.result);
        } catch (err) {
            renderRestoreError("The file isn't valid JSON — it may be corrupted or incomplete.", err.message);
            return;
        }
 
        const validationError = validateScanShape(data);
        if (validationError) {
            renderRestoreError('The file is valid JSON, but not in the shape Glassweb exports produce.', validationError);
            return;
        }
 
        lastScanData = data;
        renderResults(data);
        setState(STATE.RESULTS);
    };
    reader.onerror = () => {
        renderRestoreError("Something went wrong while reading it from disk.", String(reader.error));
    };
    reader.readAsText(file);
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

// --- Mode toggle ---
document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-mode-panel="${tab.dataset.mode}"]`).classList.add('active');
    });
});

// --- Dropzone ---
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
 
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleRestoreFile(e.target.files[0]));
 
['dragenter', 'dragover'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
);
dropzone.addEventListener('drop', (e) => handleRestoreFile(e.dataTransfer.files[0]));

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
document.getElementById('info-btn').addEventListener('click', () => toggleInfo(true));
document.getElementById('scan-btn').addEventListener('click', runScan);
document.getElementById('error-detail-toggle').addEventListener('click', () => {
    document.getElementById('error-detail').classList.toggle('open');
});
document.getElementById('restore-error-detail-toggle').addEventListener('click', () => {
    document.getElementById('restore-error-detail').classList.toggle('open');
});
document.getElementById('export-json').addEventListener('click', exportJSON);
document.getElementById('export-pdf').addEventListener('click', exportPDF);
document.getElementById('detail-close').addEventListener('click', closeRequestDetailPanel);
document.getElementById('scrim').addEventListener('click', closeRequestDetailPanel);