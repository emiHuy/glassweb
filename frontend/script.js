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

let lastScanData = null;  // most recent successful scan's data

/**
 * Toggles the visibility of the tracker information modal overlay.
 * @param {boolean} open - True to open the overlay, false to close it.
 */
function toggleInfo(open) {
    document.getElementById('info-overlay').classList.toggle('open', open);
}

// Event listeners for closing the info overlay
document.getElementById('info-close').addEventListener('click', () => toggleInfo(false));
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        toggleInfo(false);
    }
})
document.getElementById('info-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'info-overlay') {
        toggleInfo(false);
    }
});

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
    const url = normalizeUrl(document.getElementById('url-input').value);

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
    }  
}

/**
 * Renders all components of the analysis results report using API response data.
 * @param {Object} data - The complete scan results payload from the backend.
 */
function renderResults(data) {
    
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
    function renderUrls(scannedUrl, finalUrl) {
        const base = new URL(scannedUrl).hostname;
        document.getElementById('report-url-base').textContent = base;

        const finalEl = document.getElementById('report-url-final');

        if (finalUrl && finalUrl !== scannedUrl) {
            finalEl.innerHTML = `&rarr; ${finalUrl}`;
            finalEl.style.display = '';
        } else {
            finalEl.style.display = 'none';
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
    
        // Sort requests alphabetically by classification category
        const sortedRequests = [...networkRequests].sort((a, b) => {
            return a.classification.category.localeCompare(b.classification.category)
        });
        
        for (const req of sortedRequests) {
            const { color, label } = getCategoryInfo(req.classification.category);
            const isUnclassified = req.classification.category === "unclassified";
            const domain = new URL(req.url).hostname;
            const entity = req.classification.entity;

            const row = document.createElement('div');
            row.className = 'req-row' + (isUnclassified ? ' unclassified' : '');
            row.innerHTML = `
                <div class="req-accent" style="background: ${color};"></div>
                <div class="req-domain">${domain}${entity ? ` <span class="entity">${entity}</span>` : ''}</div>
                <div class="req-category">
                    <div class="dot" style="background: ${color};"></div>
                    ${label}
                </div>
                <div class="req-type">${req.resource_type}</div>
                <div class="req-method">${req.method}</div>
            `;
            table.appendChild(row);
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
    renderRequestTable(data.network_requests);
    renderStats();
    renderBreakdown(data.category_counts);
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

// Global UI trigger bindings
document.getElementById('info-btn').addEventListener('click', toggleInfo);
document.getElementById('scan-btn').addEventListener('click', runScan);
document.getElementById('error-detail-toggle').addEventListener('click', () => {
    document.getElementById('error-detail').classList.toggle('open')
});
document.getElementById('export-json').addEventListener('click', exportJSON);