/**
 * API Automation Tool 3.0
 * Loads real data from SQLite on startup
 */

class APIManagerApp {
    constructor() {
        this.state = {
            activeWorkspace: null,
            workspaces: [],
            swaggerFiles: [],
            endpoints: [],
            testCases: [],
            testSuites: [],
            secrets: [],
            certificates: [],
            environments: [],
            selectedEnvironmentId: null,
            activeEnvironmentId: null,
            environmentVariables: [],
            baseUrl: localStorage.getItem('apimanager_baseUrl') || 'http://localhost:8080',
            savedReports: JSON.parse(localStorage.getItem('apimanager_reports') || '[]'),
            selectedEndpoint: null,
            selectedSwaggerId: null,
            selectedSuiteId: null,
            selectedTestCase: null,
            showQuickTest: false,
            showSecrets: false,
            activeView: 'testcases',
            mockServerRunning: false,
            mockStatus: {},
            suiteRunProgress: {},
            loadTestResults: null,
            loading: true
        };

        this.init();
    }

    async init() {
        console.log('Initializing API Automation Tool 3.0...');

        try {
            // Load real data from database
            await this.loadFromDatabase();

            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            console.error('Failed to initialize:', error);
            Components.showToast('Failed to load application data', 'error');
        } finally {
            this.state.loading = false;
            this.render();
        }
    }



    /**
     * Load data from SQLite database via API
     */
    async loadFromDatabase() {
        try {
            // 1. Load workspaces
            const workspaces = await apiClient.getWorkspaces();
            this.state.workspaces = workspaces;

            // 2. Select first workspace or create default
            if (workspaces.length === 0) {
                // No workspaces exist - create default one
                const defaultWorkspace = await apiClient.createWorkspace({
                    name: 'My First Workspace',
                    description: 'Getting started with API testing'
                });
                this.state.workspaces = [defaultWorkspace];
                this.state.activeWorkspace = defaultWorkspace.id;

                Components.showToast('Created default workspace', 'info');
            } else {
                this.state.activeWorkspace = workspaces[0].id;
            }

            // 3. Load workspace data
            await this.loadWorkspaceData();

            // 4. Update workspace selector
            this.updateWorkspaceSelector();

            console.log('Loaded from database:', {
                workspaces: this.state.workspaces.length,
                swaggerFiles: this.state.swaggerFiles.length,
                endpoints: this.state.endpoints.length,
                testCases: this.state.testCases.length
            });

        } catch (error) {
            console.error('Failed to load from database:', error);

            // If backend is not responding, show helpful message
            if (error.message.includes('Failed to fetch')) {
                Components.showToast('Backend not available. Please start the Spring Boot server.', 'error');
            } else {
                Components.showToast('Failed to load data from database', 'error');
            }

            // Initialize with empty state
            this.state.workspaces = [];
            this.state.swaggerFiles = [];
            this.state.endpoints = [];
            this.state.testCases = [];
        }
    }

// ==================== TEST SUITES ====================

async selectTestSuite(suiteId) {
    this.state.selectedSuiteId = suiteId;
    try {
        const testCases = await apiClient.getTestCasesBySuite(suiteId);
        this.state.testCases = testCases;
        this.render();
    } catch (error) {
        console.error('Failed to load test cases:', error);
    }
}

showCreateSuiteModal() {
    const content = `
        <div class="form-group">
            <label class="form-label">Suite Name *</label>
            <input type="text" id="suite-name" class="form-control" placeholder="e.g., Regression Tests">
        </div>

        <div class="form-group">
            <label class="form-label">Suite Type *</label>
            <select id="suite-type" class="form-control">
                <option value="regression">🔄 Regression Tests</option>
                <option value="positive">✅ Positive Tests</option>
                <option value="negative"> Negative Tests</option>
                <option value="smoke">💨 Smoke Tests</option>
                <option value="integration">🔗 Integration Tests</option>
                <option value="custom">📋 Custom</option>
            </select>
        </div>

        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea id="suite-description" class="form-control" rows="3" placeholder="What does this test suite cover?"></textarea>
        </div>
    `;

    const actions = `
        <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
        <button class="btn btn-primary" onclick="app.createTestSuite()">Create Suite</button>
    `;

    Components.showModal('Create Test Suite', content, actions);
}

async createTestSuite() {
    const name = document.getElementById('suite-name').value;
    const type = document.getElementById('suite-type').value;
    const description = document.getElementById('suite-description').value;

    if (!name) {
        alert('Please enter a suite name');
        return;
    }

    try {
        const suite = await apiClient.createTestSuite({
            workspaceId: this.state.activeWorkspace,
            name,
            type,
            description
        });

        this.state.testSuites.push(suite);
        this.state.selectedSuiteId = suite.id;

        document.getElementById('modal-container').innerHTML = '';
        this.render();

        if (typeof Components.showToast === 'function') {
            Components.showToast('Test suite created successfully', 'success');
        }

    } catch (error) {
        console.error('Failed to create test suite:', error);
        alert('Failed to create test suite');
    }
}

async deleteTestSuite(suiteId) {
    if (!confirm('Delete this test suite? All test cases in this suite will also be deleted.')) {
        return;
    }

    try {
        const ok = await apiClient.deleteTestSuite(suiteId);
        if (!ok) throw new Error('Server failed to delete the suite');
        this.state.testSuites = this.state.testSuites.filter(s => s.id !== suiteId);

        if (this.state.selectedSuiteId === suiteId) {
            this.state.selectedSuiteId = this.state.testSuites.length > 0 ? this.state.testSuites[0].id : null;
            if (this.state.selectedSuiteId) {
                await this.selectTestSuite(this.state.selectedSuiteId);
            } else {
                this.state.testCases = [];
            }
        }

        this.render();

        if (typeof Components.showToast === 'function') {
            Components.showToast('Test suite deleted', 'success');
        }

    } catch (error) {
        console.error('Failed to delete test suite:', error);
        alert('Failed to delete test suite');
    }
}

showCreateTestCaseModal() {
    if (!this.state.selectedSuiteId) {
        alert('Please create a test suite first');
        return;
    }

    const content = `
        <div class="form-group">
            <label class="form-label">Test Name *</label>
            <input type="text" id="test-name" class="form-control" placeholder="e.g., Login with valid credentials">
        </div>

        <div class="form-group">
            <label class="form-label">Select Endpoint *</label>
            <select id="test-endpoint" class="form-control">
                ${this.state.endpoints.map(ep => `<option value="${ep.id}">${ep.method} ${ep.path}</option>`).join('')}
            </select>
        </div>

        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea id="test-description" class="form-control" rows="2" placeholder="What does this test validate?"></textarea>
        </div>

        <div class="form-group">
            <label class="form-label">Expected Status Code</label>
            <input type="number" id="test-status" class="form-control" value="200" placeholder="200">
        </div>
    `;

    const actions = `
        <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
        <button class="btn btn-success" onclick="app.createTestCase()">Create Test</button>
    `;

    Components.showModal('Create Test Case', content, actions);
}

async createTestCase() {
    const name = document.getElementById('test-name').value;
    const endpointId = document.getElementById('test-endpoint').value;
    const description = document.getElementById('test-description').value;
    const expectedStatus = document.getElementById('test-status').value;

    if (!name) {
        alert('Please enter a test name');
        return;
    }

    const endpoint = this.state.endpoints.find(e => e.id == endpointId);
    if (!endpoint) {
        alert('Please select an endpoint');
        return;
    }

    try {
        const testCase = await apiClient.createTestCase({
            workspaceId: this.state.activeWorkspace,
            suiteId: this.state.selectedSuiteId,
            endpointId: endpoint.id,
            name,
            description,
            method: endpoint.method,
            endpoint: endpoint.path,
            expectedStatus: parseInt(expectedStatus) || 200,
            assertions: JSON.stringify([
                { field: 'status', operator: 'equals', value: expectedStatus }
            ])
        });

        this.state.testCases.push(testCase);

        document.getElementById('modal-container').innerHTML = '';
        this.render();

        if (typeof Components.showToast === 'function') {
            Components.showToast('Test case created successfully', 'success');
        }

    } catch (error) {
        console.error('Failed to create test case:', error);
        alert('Failed to create test case');
    }
}
/**
 * Switch between tabs in Request Builder
 */
switchTab(tabName) {
    // Remove active class from all tab headers
    document.querySelectorAll('.tab-header').forEach(header => {
        header.classList.remove('active');
    });

    // Hide all tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.style.display = 'none';
    });

    // Activate clicked tab
    const activeHeader = document.querySelector(`.tab-header[data-tab="${tabName}"]`);
    if (activeHeader) {
        activeHeader.classList.add('active');
    }

    // Show corresponding pane
    const activePane = document.getElementById(`tab-${tabName}`);
    if (activePane) {
        activePane.style.display = 'block';
    }
}

/**
 * Add parameter row
 */
addParam() {
    const paramsList = document.getElementById('params-list');
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" class="form-control" placeholder="Parameter name">
        <input type="text" class="form-control" placeholder="Parameter value">
        <input type="text" class="form-control" placeholder="Description (optional)">
        <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
    `;
    paramsList.appendChild(row);
}

/**
 * Add header row
 */
addHeader() {
    const headersList = document.getElementById('headers-list');
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" class="form-control" placeholder="Header name">
        <input type="text" class="form-control" placeholder="Header value">
        <input type="text" class="form-control" placeholder="Description (optional)">
        <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
    `;
    headersList.appendChild(row);
}

/**
 * Change body type
 */
changeBodyType() {
    const bodyType = document.getElementById('body-type').value;
    const bodyContent = document.getElementById('body-content');

    switch(bodyType) {
        case 'none':
            bodyContent.innerHTML = '<p style="color: #64748b;">This request does not have a body.</p>';
            break;

        case 'json':
            bodyContent.innerHTML = `
                <textarea
                    id="request-body"
                    class="form-control"
                    rows="15"
                    placeholder='{\n  "key": "value"\n}'
                    style="font-family: 'Courier New', monospace; font-size: 0.9rem;"
                ></textarea>
            `;
            break;

        case 'form-data':
            bodyContent.innerHTML = `
                <div id="form-data-list" class="kv-list">
                    <div class="kv-row">
                        <input type="text" class="form-control" placeholder="Key">
                        <input type="text" class="form-control" placeholder="Value">
                        <select class="form-control" style="max-width: 100px;">
                            <option value="text">Text</option>
                            <option value="file">File</option>
                        </select>
                        <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
                    </div>
                </div>
                <button class="btn btn-sm" onclick="app.addFormDataRow()" style="margin-top: 0.5rem;">+ Add Field</button>
            `;
            break;

        case 'x-www-form-urlencoded':
            bodyContent.innerHTML = `
                <div id="form-urlencoded-list" class="kv-list">
                    <div class="kv-row">
                        <input type="text" class="form-control" placeholder="Key">
                        <input type="text" class="form-control" placeholder="Value">
                        <input type="text" class="form-control" placeholder="Description">
                        <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
                    </div>
                </div>
                <button class="btn btn-sm" onclick="app.addFormUrlencodedRow()" style="margin-top: 0.5rem;">+ Add Field</button>
            `;
            break;

        case 'raw':
            bodyContent.innerHTML = `
                <textarea
                    id="request-body"
                    class="form-control"
                    rows="15"
                    placeholder="Enter raw request body..."
                    style="font-family: 'Courier New', monospace; font-size: 0.9rem;"
                ></textarea>
            `;
            break;
    }
}

/**
 * Add form data row
 */
addFormDataRow() {
    const list = document.getElementById('form-data-list');
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" class="form-control" placeholder="Key">
        <input type="text" class="form-control" placeholder="Value">
        <select class="form-control" style="max-width: 100px;">
            <option value="text">Text</option>
            <option value="file">File</option>
        </select>
        <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
    `;
    list.appendChild(row);
}

/**
 * Add form urlencoded row
 */
addFormUrlencodedRow() {
    const list = document.getElementById('form-urlencoded-list');
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
        <input type="text" class="form-control" placeholder="Key">
        <input type="text" class="form-control" placeholder="Value">
        <input type="text" class="form-control" placeholder="Description">
        <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
    `;
    list.appendChild(row);
}

/**
 * Change auth type
 */
changeAuthType() {
    const authType = document.getElementById('auth-type').value;
    const authContent = document.getElementById('auth-content');

    switch(authType) {
        case 'none':
            authContent.innerHTML = `
                <p style="color: #64748b; font-size: 0.9rem;">
                    This request does not use any authorization.
                </p>
            `;
            break;

        case 'bearer':
            authContent.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Token</label>
                    <input
                        type="text"
                        id="bearer-token"
                        class="form-control"
                        placeholder="Enter bearer token"
                        style="font-family: 'Courier New', monospace;"
                    />
                    <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem;">
                        The token will be sent as: <code>Authorization: Bearer &lt;token&gt;</code>
                    </p>
                </div>
            `;
            break;

        case 'basic':
            authContent.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Username</label>
                    <input type="text" id="basic-username" class="form-control" placeholder="Enter username" />
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" id="basic-password" class="form-control" placeholder="Enter password" />
                </div>
                <p style="font-size: 0.875rem; color: #64748b;">
                    Credentials will be base64 encoded and sent as: <code>Authorization: Basic &lt;encoded&gt;</code>
                </p>
            `;
            break;

        case 'api-key':
            authContent.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Key</label>
                    <input type="text" id="api-key-name" class="form-control" placeholder="e.g., X-API-Key" />
                </div>
                <div class="form-group">
                    <label class="form-label">Value</label>
                    <input type="text" id="api-key-value" class="form-control" placeholder="Enter API key" style="font-family: 'Courier New', monospace;" />
                </div>
                <div class="form-group">
                    <label class="form-label">Add to</label>
                    <select id="api-key-location" class="form-control" style="max-width: 200px;">
                        <option value="header">Header</option>
                        <option value="query">Query Params</option>
                    </select>
                </div>
            `;
            break;

        case 'oauth2':
            authContent.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Access Token</label>
                    <input
                        type="text"
                        id="oauth-token"
                        class="form-control"
                        placeholder="Enter access token"
                        style="font-family: 'Courier New', monospace;"
                    />
                </div>
                <p style="font-size: 0.875rem; color: #64748b;">
                    💡 <strong>Tip:</strong> Get the token from your OAuth provider and paste it here.
                </p>
            `;
            break;
    }
}

/**
 * Clear request builder
 */
clearRequestBuilder() {
    // Clear params
    document.getElementById('params-list').innerHTML = '';

    // Reset headers to default
    document.getElementById('headers-list').innerHTML = `
        <div class="kv-row">
            <input type="text" class="form-control" value="Content-Type" placeholder="Header name">
            <input type="text" class="form-control" value="application/json" placeholder="Header value">
            <input type="text" class="form-control" placeholder="Description (optional)">
            <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
        </div>
    `;

    // Clear body
    const bodyTextarea = document.getElementById('request-body');
    if (bodyTextarea) {
        bodyTextarea.value = '';
    }

    // Reset auth
    document.getElementById('auth-type').value = 'none';
    this.changeAuthType();

    // Hide response
    document.getElementById('response-section').style.display = 'none';
}

setBaseUrl(value) {
    this.state.baseUrl = value.trim();
    localStorage.setItem('apimanager_baseUrl', this.state.baseUrl);
    // Update the URL input to reflect the new base URL
    const urlInput = document.getElementById('request-url');
    if (urlInput && this.state.selectedEndpoint) {
        urlInput.value = this.state.baseUrl + this.state.selectedEndpoint.path;
    }
}

async sendRequest() {
    const method = document.getElementById('request-method')?.value;
    const rawUrl = document.getElementById('request-url')?.value;
    const url = this.substituteVariables(rawUrl);
    const responseSection = document.getElementById('response-section');
    const responseContent = document.getElementById('response-content');

    if (!url) {
        this.showToast('Please enter a URL', 'error');
        return;
    }

    // Gather headers
    const headers = {};
    document.querySelectorAll('#headers-list .kv-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs[0]?.value) headers[inputs[0].value] = inputs[1]?.value || '';
    });

    // Gather body
    let body = null;
    const bodyType = document.getElementById('body-type')?.value;
    if (bodyType !== 'none' && method !== 'GET' && method !== 'DELETE') {
        body = document.getElementById('request-body')?.value || null;
        if (body) headers['Content-Type'] = 'application/json';
    }

    responseSection.style.display = 'block';
    responseContent.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner"></div><p>Sending...</p></div>';

    const certId = document.getElementById('rb-cert')?.value || null;

    try {
        const response = await apiClient.sendQuickRequest({ method, url, headers: JSON.stringify(headers), body, certId, forceProxy: !!certId });
        responseContent.innerHTML = Components.renderQuickTestResponse(response);
        this._runRequestAssertions(response);
    } catch (error) {
        responseContent.innerHTML = `<div style="padding:1rem;background:#fee2e2;border-radius:0.5rem;color:#991b1b"><strong>Error:</strong> ${error.error || error.message}</div>`;
    }
}

_runRequestAssertions(response) {
    const resultsEl = document.getElementById('assertion-results');
    if (!resultsEl) return;

    const rows = document.querySelectorAll('#request-assertions-list .assertion-row');
    const expectedStatus = parseInt(document.getElementById('assert-expected-status')?.value) || 200;

    const results = [];

    // Status assertion always runs
    const statusPassed = response.status === expectedStatus;
    results.push({ label: `Status equals ${expectedStatus}`, passed: statusPassed, actual: response.status });

    // Field assertions
    rows.forEach(row => {
        const field = row.querySelector('.assertion-field')?.value.trim();
        const operator = row.querySelector('.assertion-operator')?.value;
        const expected = row.querySelector('.assertion-value')?.value.trim();
        if (!field) return;
        let actual;
        if (field.startsWith('header.')) {
            const headerName = field.slice('header.'.length).toLowerCase();
            const respHeaders = response.headers || {};
            actual = respHeaders[headerName] ?? null;
        } else {
            actual = this._getByDotPath(response.body, field);
        }
        const passed = this._evalAssertion(actual, operator, expected);
        results.push({ label: `${field} ${operator.replace(/_/g,' ')} ${expected}`, passed, actual: JSON.stringify(actual) });
    });

    const allPassed = results.every(r => r.passed);
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = `
        <div style="font-weight:600;margin-bottom:0.5rem;color:${allPassed ? '#059669' : '#dc2626'};">
            ${allPassed ? '✅ All assertions passed' : '❌ Some assertions failed'}
        </div>
        ${results.map(r => `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid #f1f5f9;font-size:0.875rem;">
                <span style="color:${r.passed ? '#059669' : '#dc2626'};">${r.passed ? '✓' : '✗'}</span>
                <span style="flex:1;">${r.label}</span>
                ${!r.passed ? `<span style="color:#6b7280;font-size:0.8rem;">got: ${r.actual}</span>` : ''}
            </div>
        `).join('')}
    `;
    // Switch to assertions tab so results are visible
    this.switchTab('assertions');
}

_getByDotPath(obj, path) {
    return path.split('.').reduce((cur, key) => {
        if (cur == null) return undefined;
        const arrMatch = key.match(/^(.+)\[(\d+)\]$/);
        if (arrMatch) return cur[arrMatch[1]]?.[parseInt(arrMatch[2])];
        return cur[key];
    }, obj);
}

_evalAssertion(actual, operator, expected) {
    const actualStr = String(actual ?? '');
    const actualNum = parseFloat(actual);
    const expectedNum = parseFloat(expected);
    switch (operator) {
        // Equality
        case 'equals':                return actualStr === expected;
        case 'not_equals':            return actualStr !== expected;
        // String
        case 'contains':              return actualStr.includes(expected);
        case 'not_contains':          return !actualStr.includes(expected);
        case 'starts_with':           return actualStr.startsWith(expected);
        case 'ends_with':             return actualStr.endsWith(expected);
        case 'matches_regex':         { try { return new RegExp(expected).test(actualStr); } catch { return false; } }
        // Comparison
        case 'greater_than':          return actualNum > expectedNum;
        case 'less_than':             return actualNum < expectedNum;
        case 'greater_than_or_equal': return actualNum >= expectedNum;
        case 'less_than_or_equal':    return actualNum <= expectedNum;
        // Type checks
        case 'is_number':             return typeof actual === 'number' || (!isNaN(actual) && actual !== '' && actual !== null);
        case 'is_integer':            return Number.isInteger(actual) || (typeof actual === 'string' && /^-?\d+$/.test(actual.trim()));
        case 'is_double':             return typeof actual === 'number' && !Number.isInteger(actual);
        case 'is_string':             return typeof actual === 'string';
        case 'is_boolean':            return typeof actual === 'boolean';
        case 'is_array':              return Array.isArray(actual);
        case 'is_object':             return actual !== null && typeof actual === 'object' && !Array.isArray(actual);
        case 'is_null':               return actual === null || actual === undefined;
        case 'is_not_null':           return actual !== null && actual !== undefined;
        // Length
        case 'length_equals':         return (actual?.length ?? actualStr.length) === parseInt(expected);
        case 'length_greater_than':   return (actual?.length ?? actualStr.length) > parseInt(expected);
        case 'length_less_than':      return (actual?.length ?? actualStr.length) < parseInt(expected);
        // Presence
        case 'exists':                return actual !== undefined && actual !== null;
        case 'not_exists':            return actual === undefined || actual === null;
        case 'is_empty':              return actual === '' || actual === null || actual === undefined || (Array.isArray(actual) && actual.length === 0) || (typeof actual === 'object' && actual !== null && Object.keys(actual).length === 0);
        case 'is_not_empty':          return actual !== '' && actual !== null && actual !== undefined && !(Array.isArray(actual) && actual.length === 0) && !(typeof actual === 'object' && actual !== null && Object.keys(actual).length === 0);
        default:                      return false;
    }
}

/**
 * Save as test case (placeholder)
 */
saveAsTestCase() {
    alert('Save as Test Case will be implemented when we add Test Suites feature!');
}

async deleteTestCase(testId) {
    if (!confirm('Delete this test case?')) {
        return;
    }

    try {
        await apiClient.deleteTestCase(testId);
        this.state.testCases = this.state.testCases.filter(t => t.id !== testId);
        this.render();

        if (typeof Components.showToast === 'function') {
            Components.showToast('Test case deleted', 'success');
        }

    } catch (error) {
        console.error('Failed to delete test case:', error);
        alert('Failed to delete test case');
    }
}
    /**
     * Load workspace data from database
     */
    async loadWorkspaceData() {
        if (!this.state.activeWorkspace) return;

        try {
            const data = await apiClient.getWorkspaceData(this.state.activeWorkspace);

            this.state.swaggerFiles = data.swaggerFiles || [];
            this.state.endpoints = data.endpoints || [];

            // Validate selectedSwaggerId — reset if the swagger was deleted
            if (this.state.selectedSwaggerId) {
                const still = this.state.swaggerFiles.find(s => s.id === this.state.selectedSwaggerId);
                if (!still) this.state.selectedSwaggerId = null;
            }

            // Auto-select first swagger if nothing selected
            if (!this.state.selectedSwaggerId && this.state.swaggerFiles.length > 0) {
                this.state.selectedSwaggerId = this.state.swaggerFiles[0].id;
            }

            // Validate selectedEndpoint — endpoints may have been recreated with new IDs after a sync
            if (this.state.selectedEndpoint) {
                const refreshed = this.state.endpoints.find(e => e.id === this.state.selectedEndpoint.id);
                if (refreshed) {
                    // Update with fresh data (same ID — e.g. test-case run result changes)
                    this.state.selectedEndpoint = refreshed;
                } else {
                    // ID no longer exists (refresh recreated endpoints) — try to match by method+path
                    const matched = this.state.endpoints.find(
                        e => e.method === this.state.selectedEndpoint.method &&
                             e.path === this.state.selectedEndpoint.path
                    );
                    this.state.selectedEndpoint = matched || null;
                }
            }

            // Load test suites
            const suites = await apiClient.getTestSuites(this.state.activeWorkspace);
            this.state.testSuites = suites;

            // Load certificates
            try {
                this.state.certificates = await apiClient.getCertificates(this.state.activeWorkspace);
            } catch(e) { this.state.certificates = []; }

            // Auto-select first suite
            if (suites.length > 0 && !this.state.selectedSuiteId) {
                this.state.selectedSuiteId = suites[0].id;
                const testCases = await apiClient.getTestCasesBySuite(suites[0].id);
                this.state.testCases = testCases;
            } else if (suites.length === 0) {
                this.state.testCases = [];
            }

            // Load active environment variables for substitution
            try {
                const activeEnv = await apiClient.getActiveEnvironment(this.state.activeWorkspace);
                if (activeEnv && activeEnv.id) {
                    this.state.environmentVariables = await apiClient.getVariables(activeEnv.id);
                }
            } catch(e) { /* no active env */ }

            this.renderSidebar();
            this.render();

        } catch (error) {
            console.error('Failed to load workspace data:', error);
        }
    }

    /**
     * Update workspace selector dropdown
     */
    updateWorkspaceSelector() {
        const selector = document.getElementById('workspace-selector');
        selector.innerHTML = this.state.workspaces
            .map(w => `<option value="${w.id}" ${w.id === this.state.activeWorkspace ? 'selected' : ''}>${w.name}</option>`)
            .join('');
    }

    selectSwagger(swaggerId) {
        this.state.selectedSwaggerId = swaggerId;
        this.state.selectedEndpoint = null;
        this.renderSidebar();
        this.render();
    }

    setupEventListeners() {
        // Quick Test Button
        document.getElementById('quick-test-btn').addEventListener('click', () => {
            this.state.showQuickTest = !this.state.showQuickTest;
            if (this.state.showQuickTest) {
                document.getElementById('quick-test-btn').classList.add('active');
                document.getElementById('view-tabs').style.display = 'none';
            } else {
                document.getElementById('quick-test-btn').classList.remove('active');
                document.getElementById('view-tabs').style.display = 'flex';
            }
            this.render();
        });

        // Workspace Selector
        document.getElementById('workspace-selector').addEventListener('change', async (e) => {
            this.state.activeWorkspace = parseInt(e.target.value);
            await this.loadWorkspaceData();
        });

        // Add Swagger Button
        document.getElementById('add-swagger-btn').addEventListener('click', () => {
            this.showAddSwaggerModal();
        });

        // New Workspace Button
        document.getElementById('new-workspace-btn').addEventListener('click', () => {
            this.showNewWorkspaceModal();
        });

        // Tab Switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const prev = this.state.activeView;
                this.state.activeView = tab.dataset.view;
                this.state.showQuickTest = false;
                document.getElementById('quick-test-btn').classList.remove('active');
                document.getElementById('view-tabs').style.display = 'flex';

                // Stop log polling when leaving mock server tab
                if (prev === 'mockserver' && this.state.activeView !== 'mockserver') {
                    this._stopMockLogPolling();
                }

                this.render();
            });
        });

        // Quick Test Method Change
        document.addEventListener('change', (e) => {
            if (e.target.id === 'qt-method') {
                const method = e.target.value;
                const bodyGroup = document.getElementById('qt-body-group');
                if (bodyGroup) {
                    bodyGroup.style.display = (method === 'GET' || method === 'DELETE') ? 'none' : 'block';
                }
            }
        });
    }

    render() {
        const mainContent = document.getElementById('main-content');

     if (this.state.loading) {
             mainContent.innerHTML = '<div style="text-align: center; padding: 3rem;"><div class="spinner"></div><p>Loading from database...</p></div>';
             return;
         }

        if (this.state.showQuickTest) {
            mainContent.innerHTML = Components.renderQuickTestPanel();
            // Populate cert picker with workspace certificates
            const qtCert = document.getElementById('qt-cert');
            if (qtCert && this.state.certificates?.length) {
                qtCert.innerHTML = '<option value="">— None —</option>' +
                    this.state.certificates.map(c =>
                        `<option value="${c.id}">${c.name} (${c.environment})</option>`
                    ).join('');
            }
            return;
        }

        switch (this.state.activeView) {
            case 'request':
                if (this.state.selectedEndpoint) {
                    mainContent.innerHTML = Components.renderRequestBuilder(this.state.selectedEndpoint);
                } else if (this.state.endpoints.length > 0) {
                    mainContent.innerHTML = Components.renderRequestBuilder(this.state.endpoints[0]);
                } else {
                    mainContent.innerHTML = Components.renderEmptyState('No endpoints available', 'Upload a Swagger file to get started');
                }
                // Populate cert picker
                this._populateRbCertPicker();
                break;

             case 'testcases':
                 mainContent.innerHTML = Components.renderTestCases(this.state.testSuites, this.state.testCases);
                 break;

            case 'mockserver':
                this.renderMockServerView();
                break;

            case 'loadtest':
                mainContent.innerHTML = Components.renderLoadTest(this.state.endpoints, this.state.baseUrl, this.state.swaggerFiles);
                this._updateLoadBodyVisibility();
                // Populate cert picker
                this._populateLoadCertPicker();
                // Restore running/completed state if a test was active before tab switch
                if (this._activeLoadTestId) {
                    if (this._loadTestInterval) {
                        // Still running — restore running UI
                        const sb = document.getElementById('load-start-btn');
                        const xb = document.getElementById('load-stop-btn');
                        if (sb) { sb.disabled = true; sb.textContent = 'Running...'; }
                        if (xb) xb.style.display = '';
                    } else if (this.state.loadTestResults) {
                        // Completed while on another tab — show results
                        this._showLoadTestResults(this.state.loadTestResults);
                    }
                }
                break;

            case 'documentation': {
                const docEndpoints = this.state.selectedSwaggerId
                    ? this.state.endpoints.filter(e => e.swaggerFileId === this.state.selectedSwaggerId)
                    : this.state.endpoints;
                const selectedSwagger = this.state.swaggerFiles.find(s => s.id === this.state.selectedSwaggerId);
                if (docEndpoints.length > 0) {
                    mainContent.innerHTML = Components.renderDocumentation(docEndpoints, selectedSwagger?.name);
                } else {
                    mainContent.innerHTML = Components.renderEmptyState('No API documentation', 'Select a Swagger file from the sidebar to view its documentation');
                }
                break;
            }
            case 'environments':
                this.renderEnvironmentsView();
                break;

            case 'reports':
                this.renderReportsView();
                break;

            case 'certificates':
                this.renderCertificatesView();
                break;

            default:
                mainContent.innerHTML = Components.renderTestCases(this.state.testSuites, this.state.testCases);
        }
    }

    renderSidebar() {
        const swaggerList = document.getElementById('swagger-list');

        if (this.state.swaggerFiles.length === 0) {
            swaggerList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.875rem;">No Swagger files yet</div>';
        } else {
            swaggerList.innerHTML = this.state.swaggerFiles
                .map(swagger => Components.renderSwaggerCard(swagger, swagger.id === this.state.selectedSwaggerId))
                .join('');
        }

        const endpointsList = document.getElementById('endpoints-list');
        const endpointCount = document.getElementById('endpoint-count');

        // FILTER ENDPOINTS BY SELECTED SWAGGER
        let filteredEndpoints = this.state.endpoints;
        if (this.state.selectedSwaggerId) {
            filteredEndpoints = this.state.endpoints.filter(
                ep => ep.swaggerFileId === this.state.selectedSwaggerId
            );
        }

        endpointCount.textContent = filteredEndpoints.length;

        // Reset search/filter inputs when swagger changes
        const searchEl = document.getElementById('endpoint-search');
        const methodEl = document.getElementById('endpoint-method-filter');
        if (searchEl) searchEl.value = '';
        if (methodEl) methodEl.value = '';

        if (filteredEndpoints.length === 0) {
            endpointsList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.875rem;">No endpoints yet</div>';
        } else {
            endpointsList.innerHTML = filteredEndpoints
                .map(endpoint => Components.renderEndpointCard(endpoint, endpoint.id === this.state.selectedEndpoint?.id))
                .join('');
        }
    }

    filterEndpoints() {
        const searchEl = document.getElementById('endpoint-search');
        const methodEl = document.getElementById('endpoint-method-filter');
        const endpointsList = document.getElementById('endpoints-list');
        const endpointCount = document.getElementById('endpoint-count');

        const searchText = (searchEl?.value || '').toLowerCase();
        const methodFilter = (methodEl?.value || '').toUpperCase();

        let filtered = this.state.endpoints;
        if (this.state.selectedSwaggerId) {
            filtered = filtered.filter(ep => ep.swaggerFileId === this.state.selectedSwaggerId);
        }

        if (methodFilter) {
            filtered = filtered.filter(ep => (ep.method || '').toUpperCase() === methodFilter);
        }

        if (searchText) {
            filtered = filtered.filter(ep =>
                (ep.path || '').toLowerCase().includes(searchText) ||
                (ep.summary || '').toLowerCase().includes(searchText) ||
                (ep.description || '').toLowerCase().includes(searchText)
            );
        }

        endpointCount.textContent = filtered.length;

        if (filtered.length === 0) {
            endpointsList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.875rem;">No matching endpoints</div>';
        } else {
            endpointsList.innerHTML = filtered
                .map(endpoint => Components.renderEndpointCard(endpoint, endpoint.id === this.state.selectedEndpoint?.id))
                .join('');
        }
    }

    filterDocs() {
        const q = (document.getElementById('docs-search')?.value || '').toLowerCase();
        const method = (document.getElementById('docs-method-filter')?.value || '').toUpperCase();
        const sections = document.querySelectorAll('#docs-content .docs-section');
        sections.forEach(section => {
            let anyVisible = false;
            section.querySelectorAll('.docs-endpoint').forEach(card => {
                const cardMethod = card.querySelector('.method-badge')?.textContent?.trim().toUpperCase() || '';
                const matchesMethod = !method || cardMethod === method;
                const matchesSearch = !q || card.textContent.toLowerCase().includes(q);
                const show = matchesMethod && matchesSearch;
                card.style.display = show ? '' : 'none';
                if (show) anyVisible = true;
            });
            section.style.display = anyVisible ? '' : 'none';
        });
    }

    /**
     * Render Environments view
     */
    async renderEnvironmentsView() {
        if (!this.state.activeWorkspace) return;
        try {
            // Load environments
            const environments = await apiClient.getEnvironments(this.state.activeWorkspace);
            this.state.environments = environments;
            
            // Find active environment
            const activeEnv = environments.find(e => e.isActive);
            this.state.activeEnvironmentId = activeEnv?.id || null;
            
            const content = `
                <div class="environments-view">
                    <div class="view-header">
                        <h2>🌍 Environments & Variables</h2>
                        <button class="btn btn-primary" onclick="app.showCreateEnvironmentModal()">
                            + New Environment
                        </button>
                    </div>
                    
                    ${this.state.environments.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-icon">🌍</div>
                            <h3>No Environments Yet</h3>
                            <p>Create an environment to manage base URLs, API keys, and other configuration variables.</p>
                            <button class="btn btn-primary" onclick="app.showCreateEnvironmentModal()">
                                Create Your First Environment
                            </button>
                        </div>
                    ` : `
                        <div class="environments-grid">
                            ${this.state.environments.map(env => this.renderEnvironmentCard(env)).join('')}
                        </div>
                    `}
                </div>
            `;
            
            document.getElementById('main-content').innerHTML = content;
            
        } catch (error) {
            console.error('Failed to load environments:', error);
            this.showToast(' Failed to load environments', 'error');
        }
    }
    
    /**
     * Render environment card
     */
    renderEnvironmentCard(env) {
        const isActive = env.id === this.state.activeEnvironmentId;
        
        return `
            <div class="environment-card ${isActive ? 'active' : ''}" data-env-id="${env.id}">
                <div class="env-card-header">
                    <div>
                        <h3>${env.name}</h3>
                        ${isActive ? '<span class="badge badge-success">Active</span>' : ''}
                    </div>
                    <div class="env-card-actions">
                        ${!isActive ? `
                            <button class="btn btn-sm" onclick="app.activateEnvironment(${env.id})">
                                ✓ Activate
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="app.deleteEnvironment(${env.id})" title="Delete">
                            ×
                        </button>
                    </div>
                </div>
                
                ${env.description ? `<p class="env-description">${env.description}</p>` : ''}
                
                <div class="env-stats">
                    <span>📋 ${env.variableCount || 0} variables</span>
                </div>
                
                <button class="btn btn-block" onclick="app.showEnvironmentVariables(${env.id})">
                    Manage Variables →
                </button>
            </div>
        `;
    }
    
    /**
     * Show create environment modal
     */
    showCreateEnvironmentModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Environment Name *</label>
                <input 
                    type="text" 
                    id="env-name" 
                    class="form-control" 
                    placeholder="e.g., QA, Staging, Production"
                    autofocus
                />
            </div>
            
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea 
                    id="env-description" 
                    class="form-control" 
                    rows="3"
                    placeholder="Describe this environment..."
                ></textarea>
            </div>
            
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="env-is-active" />
                    Set as active environment
                </label>
            </div>
        `;
        
        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">
                Cancel
            </button>
            <button class="btn btn-primary" onclick="app.confirmCreateEnvironment()">
                Create Environment
            </button>
        `;
        
        Components.showModal('Create Environment', content, actions);
    }
    
    /**
     * Confirm create environment
     */
    async confirmCreateEnvironment() {
        const name = document.getElementById('env-name')?.value.trim();
        const description = document.getElementById('env-description')?.value.trim();
        const isActive = document.getElementById('env-is-active')?.checked;
        
        if (!name) {
            this.showToast('⚠️ Please enter environment name', 'error');
            return;
        }
        
        try {
            const envData = {
                workspaceId: this.state.activeWorkspace,
                name,
                description,
                isActive
            };
            
            await apiClient.createEnvironment(envData);
            
            this.showToast('✅ Environment created successfully!', 'success');
            document.getElementById('modal-container').innerHTML = '';
            
            // Reload view
            this.renderEnvironmentsView();
            
        } catch (error) {
            console.error('Failed to create environment:', error);
            this.showToast(' Failed to create environment', 'error');
        }
    }
    
    /**
     * Activate environment
     */
    async activateEnvironment(environmentId) {
        try {
            await apiClient.activateEnvironment(environmentId);
            this.showToast('✅ Environment activated!', 'success');
            // Reload env variables so substitution uses the new active env
            try {
                this.state.environmentVariables = await apiClient.getVariables(environmentId);
            } catch(e) {}
            this.renderEnvironmentsView();
        } catch (error) {
            console.error('Failed to activate environment:', error);
            this.showToast(' Failed to activate environment', 'error');
        }
    }
    
    /**
     * Delete environment
     */
    async deleteEnvironment(environmentId) {
        if (!confirm('Delete this environment and all its variables?')) {
            return;
        }
        
        try {
            await apiClient.deleteEnvironment(environmentId);
            this.showToast('✅ Environment deleted', 'success');
            this.renderEnvironmentsView();
        } catch (error) {
            console.error('Failed to delete environment:', error);
            this.showToast(' Failed to delete environment', 'error');
        }
    }
    
    /**
     * Show environment variables modal
     */
    async showEnvironmentVariables(environmentId) {
        try {
            const variables = await apiClient.getVariables(environmentId);
            const env = this.state.environments.find(e => e.id === environmentId);
            
            this.state.selectedEnvironmentId = environmentId;
            this.state.environmentVariables = variables;
            
            const content = `
                <div class="variables-list">
                    <div class="variables-header">
                        <button class="btn btn-primary btn-sm" onclick="app.showAddVariableForm()">
                            + Add Variable
                        </button>
                    </div>
                    
                    ${variables.length === 0 ? `
                        <div class="empty-state-small">
                            <p>No variables defined yet</p>
                        </div>
                    ` : `
                        <table class="variables-table">
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Value</th>
                                    <th>Type</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${variables.map(v => `
                                    <tr>
                                        <td><code>${v.key}</code></td>
                                        <td>${v.isSecret ? v.maskedValue || '****' : v.value}</td>
                                        <td>${v.type || 'text'}</td>
                                        <td>
                                            <button class="btn-icon-sm" onclick="app.editVariable(${v.id})" title="Edit">✎</button>
                                            <button class="btn-icon-sm" onclick="app.deleteVariable(${v.id})" title="Delete">×</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                    
                    <div id="variable-form-container"></div>
                </div>
            `;
            
            const actions = `
                <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">
                    Close
                </button>
            `;
            
            Components.showModal(`Variables - ${env.name}`, content, actions);
            
        } catch (error) {
            console.error('Failed to load variables:', error);
            this.showToast(' Failed to load variables', 'error');
        }
    }
    
    /**
     * Show add variable form
     */
    showAddVariableForm() {
        const formContainer = document.getElementById('variable-form-container');
        formContainer.innerHTML = `
            <div class="variable-form">
                <h4>Add Variable</h4>
                <div class="form-group">
                    <label class="form-label">Key *</label>
                    <input type="text" id="var-key" class="form-control" placeholder="e.g., fraud-base-qa-url" />
                </div>
                <div class="form-group">
                    <label class="form-label">Value *</label>
                    <input type="text" id="var-value" class="form-control" placeholder="e.g., https://api-qa.example.com" />
                </div>
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select id="var-type" class="form-control">
                        <option value="text">Text</option>
                        <option value="url">URL</option>
                        <option value="secret">Secret</option>
                        <option value="number">Number</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="var-is-secret" />
                        Mark as secret (mask in UI)
                    </label>
                </div>
                <div class="form-actions">
                    <button class="btn btn-text" onclick="document.getElementById('variable-form-container').innerHTML = ''">Cancel</button>
                    <button class="btn btn-primary" onclick="app.confirmAddVariable()">Add Variable</button>
                </div>
            </div>
        `;
    }
    
    /**
     * Confirm add variable
     */
    async confirmAddVariable() {
        const key = document.getElementById('var-key')?.value.trim();
        const value = document.getElementById('var-value')?.value.trim();
        const type = document.getElementById('var-type')?.value;
        const isSecret = document.getElementById('var-is-secret')?.checked;
        
        if (!key || !value) {
            this.showToast('⚠️ Key and value are required', 'error');
            return;
        }
        
        try {
            const variableData = {
                key,
                value,
                type,
                isSecret
            };
            
            await apiClient.saveVariable(this.state.selectedEnvironmentId, variableData);
            
            this.showToast('✅ Variable added!', 'success');
            
            // Reload variables
            this.showEnvironmentVariables(this.state.selectedEnvironmentId);
            
        } catch (error) {
            console.error('Failed to add variable:', error);
            this.showToast(' Failed to add variable', 'error');
        }
    }
    
    /**
     * Delete variable
     */
    async deleteVariable(variableId) {
        if (!confirm('Delete this variable?')) {
            return;
        }

        try {
            await apiClient.deleteVariable(variableId);
            this.showToast('✅ Variable deleted', 'success');
            this.showEnvironmentVariables(this.state.selectedEnvironmentId);
        } catch (error) {
            console.error('Failed to delete variable:', error);
            this.showToast(' Failed to delete variable', 'error');
        }
    }

    async editVariable(variableId) {
        // Fetch all variables for the current environment and find the one to edit
        let variable;
        try {
            const variables = await apiClient.getVariables(this.state.selectedEnvironmentId);
            variable = variables.find(v => v.id === variableId);
        } catch (e) {
            this.showToast('Failed to load variable', 'error');
            return;
        }
        if (!variable) return;

        const formContainer = document.getElementById('variable-form-container');
        formContainer.innerHTML = `
            <div class="variable-form">
                <h4>Edit Variable</h4>
                <div class="form-group">
                    <label class="form-label">Key *</label>
                    <input type="text" id="edit-var-key" class="form-control" value="${variable.key || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Value *</label>
                    <input type="text" id="edit-var-value" class="form-control" value="${variable.isSecret ? '' : (variable.value || '')}" placeholder="${variable.isSecret ? '(secret — enter new value to change)' : ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select id="edit-var-type" class="form-control">
                        <option value="text" ${variable.type === 'text' ? 'selected' : ''}>Text</option>
                        <option value="url" ${variable.type === 'url' ? 'selected' : ''}>URL</option>
                        <option value="secret" ${variable.type === 'secret' ? 'selected' : ''}>Secret</option>
                        <option value="number" ${variable.type === 'number' ? 'selected' : ''}>Number</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="edit-var-is-secret" ${variable.isSecret ? 'checked' : ''}>
                        Mark as secret (mask in UI)
                    </label>
                </div>
                <div class="form-actions">
                    <button class="btn btn-text" onclick="document.getElementById('variable-form-container').innerHTML = ''">Cancel</button>
                    <button class="btn btn-primary" onclick="app.confirmEditVariable(${variableId})">Save Changes</button>
                </div>
            </div>
        `;
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async confirmEditVariable(variableId) {
        const key = document.getElementById('edit-var-key')?.value.trim();
        const value = document.getElementById('edit-var-value')?.value.trim();
        const type = document.getElementById('edit-var-type')?.value;
        const isSecret = document.getElementById('edit-var-is-secret')?.checked;

        if (!key) {
            this.showToast('⚠️ Key is required', 'error');
            return;
        }

        try {
            const payload = { key, type, isSecret };
            if (value) payload.value = value;

            await apiClient.updateVariable(variableId, payload);
            this.showToast('✅ Variable updated', 'success');
            this.showEnvironmentVariables(this.state.selectedEnvironmentId);
        } catch (error) {
            console.error('Failed to update variable:', error);
            this.showToast('Failed to update variable', 'error');
        }
    }

/**
 * Fill request builder with fake data from swagger
 */
async fillWithFakeData(endpointId) {
    try {
        // Show loading indicator
        const mainContent = document.getElementById('main-content');
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'fake-data-loading';
        loadingDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 9999; text-align: center;';
        loadingDiv.innerHTML = `
            <div class="spinner" style="margin: 0 auto 1rem;"></div>
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">🎲 Generating Fake Data</h3>
            <p style="margin: 0; color: #64748b; font-size: 0.9rem;">Reading swagger spec and creating realistic test data...</p>
        `;
        document.body.appendChild(loadingDiv);

        // Generate fake data
        const fakeData = await apiClient.generateFakeData(endpointId);

        console.log('Generated fake data:', fakeData);

        // Fill params
        if (fakeData.params && Object.keys(fakeData.params).length > 0) {
            const paramsList = document.getElementById('params-list');
            paramsList.innerHTML = ''; // Clear existing

            for (const [key, value] of Object.entries(fakeData.params)) {
                const row = document.createElement('div');
                row.className = 'kv-row';
                row.innerHTML = `
                    <input type="text" class="form-control" value="${this.escapeHtml(key)}" placeholder="Parameter name">
                    <input type="text" class="form-control" value="${this.escapeHtml(String(value))}" placeholder="Parameter value">
                    <input type="text" class="form-control" placeholder="Auto-generated from swagger" readonly style="opacity: 0.7;">
                    <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
                `;
                paramsList.appendChild(row);
            }
        }

        // Fill headers
        if (fakeData.headers && Object.keys(fakeData.headers).length > 0) {
            const headersList = document.getElementById('headers-list');
            headersList.innerHTML = ''; // Clear existing

            for (const [key, value] of Object.entries(fakeData.headers)) {
                const row = document.createElement('div');
                row.className = 'kv-row';
                row.innerHTML = `
                    <input type="text" class="form-control" value="${this.escapeHtml(key)}" placeholder="Header name">
                    <input type="text" class="form-control" value="${this.escapeHtml(String(value))}" placeholder="Header value">
                    <input type="text" class="form-control" placeholder="Auto-generated from swagger" readonly style="opacity: 0.7;">
                    <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
                `;
                headersList.appendChild(row);
            }
        }

        // Fill body
        if (fakeData.body && Object.keys(fakeData.body).length > 0) {
            // Switch to body tab
            this.switchTab('body');

            // Set body type to JSON
            const bodyTypeSelect = document.getElementById('body-type');
            if (bodyTypeSelect) {
                bodyTypeSelect.value = 'json';
                this.changeBodyType();
            }

            // Fill body textarea with formatted JSON
            const bodyTextarea = document.getElementById('request-body');
            if (bodyTextarea) {
                bodyTextarea.value = JSON.stringify(fakeData.body, null, 2);
            }
        }

        // Fill auth
        if (fakeData.auth && fakeData.auth.required) {
            // Switch to auth tab
            this.switchTab('auth');

            const authTypes = fakeData.auth.types || [];
            const authTypeSelect = document.getElementById('auth-type');

            if (authTypes.length > 0) {
                const authType = authTypes[0].toLowerCase();

                if (authType.includes('bearer')) {
                    authTypeSelect.value = 'bearer';
                    this.changeAuthType();

                    // Fill bearer token
                    setTimeout(() => {
                        const tokenInput = document.getElementById('bearer-token');
                        if (tokenInput) {
                            const bearerToken = fakeData.headers?.Authorization?.replace('Bearer ', '') ||
                                              this.generateRandomToken();
                            tokenInput.value = bearerToken;
                        }
                    }, 100);

                } else if (authType.includes('basic')) {
                    authTypeSelect.value = 'basic';
                    this.changeAuthType();

                    setTimeout(() => {
                        const usernameInput = document.getElementById('basic-username');
                        const passwordInput = document.getElementById('basic-password');
                        if (usernameInput) usernameInput.value = 'admin';
                        if (passwordInput) passwordInput.value = 'password123';
                    }, 100);

                } else if (authType.includes('api') || authType.includes('key')) {
                    authTypeSelect.value = 'api-key';
                    this.changeAuthType();

                    setTimeout(() => {
                        const keyNameInput = document.getElementById('api-key-name');
                        const keyValueInput = document.getElementById('api-key-value');
                        if (keyNameInput) keyNameInput.value = 'X-API-Key';
                        if (keyValueInput) keyValueInput.value = this.generateRandomToken();
                    }, 100);
                }
            }
        }

        // Remove loading indicator
        loadingDiv.remove();

        // Show success message
        this.showToast('✅ Fake data generated successfully from Swagger spec!', 'success');

        // Switch back to params tab to show the result
        this.switchTab('params');

    } catch (error) {
        console.error('Failed to generate fake data:', error);

        // Remove loading indicator
        const loadingDiv = document.getElementById('fake-data-loading');
        if (loadingDiv) loadingDiv.remove();

        // Show error
        this.showToast(' Failed to generate fake data: ' + error.message, 'error');
    }
}

/**
 * Helper: Escape HTML
 */
escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Helper: Generate random token
 */
generateRandomToken() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Helper: Show toast notification
 */
showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

    renderSecrets() {
        const secretsList = document.getElementById('secrets-list');

        if (this.state.secrets.length === 0) {
            secretsList.innerHTML = '<div style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.875rem;">No secrets yet</div>';
        } else {
            secretsList.innerHTML = this.state.secrets.map(secret => `
                <div class="secret-item">
                    <div class="secret-name">${secret.name}</div>
                    <div class="secret-meta">
                        <span class="secret-env env-${secret.env}">${secret.environment}</span>
                        <span style="color: #9ca3af; font-size: 0.75rem;">${secret.lastUsed || 'Never used'}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Download Reports
    async downloadTestReport() {
        if (this.state.testCases.length === 0) {
            Components.showToast('No test cases to report', 'info');
            return;
        }

        const workspaceName = this.state.workspaces.find(w => w.id === this.state.activeWorkspace)?.name || 'Workspace';
        const html = reportGenerator.generateTestExecutionReport(this.state.testCases, workspaceName);
        const filename = `test-execution-report-${Date.now()}.html`;
        reportGenerator.downloadReport(html, filename);
        Components.showToast('Test report downloaded successfully', 'success');
    }

    async downloadLoadTestReport() {
        if (!this.state.loadTestResults) {
            this.showToast('No load test results available — run a test first', 'info');
            return;
        }
        const html = this._buildLoadTestReportHtml(this.state.loadTestResults);
        const filename = `load-test-report-${Date.now()}.html`;
        reportGenerator.downloadReport(html, filename);
        this.showToast('Load test report downloaded', 'success');
    }

    // ==================== LOAD TEST ====================

    _populateLoadCertPicker() {
        const sel = document.getElementById('load-cert');
        if (!sel) return;
        const certs = this.state.certificates || [];
        sel.innerHTML = '<option value="">— None —</option>' +
            certs.map(c => `<option value="${c.id}">${c.name} (${c.environment})</option>`).join('');
    }

    _populateRbCertPicker() {
        const sel = document.getElementById('rb-cert');
        if (!sel) return;
        const certs = this.state.certificates || [];
        sel.innerHTML = '<option value="">— None —</option>' +
            certs.map(c => `<option value="${c.id}">${c.name} (${c.environment})</option>`).join('');
    }

    _updateLoadBodyVisibility() {
        const method = document.getElementById('load-method')?.value || 'GET';
        const section = document.getElementById('load-body-section');
        if (section) section.style.display = ['POST','PUT','PATCH'].includes(method) ? '' : 'none';
    }

    _loadTestSwaggerChanged(swaggerId) {
        const picker = document.getElementById('load-endpoint-picker');
        if (!picker) return;
        if (!swaggerId) {
            picker.innerHTML = '<option value="">— select swagger first —</option>';
            return;
        }
        const filtered = this.state.endpoints.filter(e => String(e.swaggerFileId) === String(swaggerId));
        if (!filtered.length) {
            picker.innerHTML = '<option value="">— no endpoints in this swagger —</option>';
            return;
        }
        picker.innerHTML = '<option value="">— pick an endpoint —</option>' +
            filtered.map(e =>
                `<option value="${e.id}" data-method="${e.method}" data-path="${e.path}">${e.method} ${e.path}</option>`
            ).join('');
    }

    _pickLoadEndpoint(sel) {
        const opt = sel.options[sel.selectedIndex];
        if (!opt.value) return;
        const method = opt.dataset.method;
        const path   = opt.dataset.path;
        const methodEl = document.getElementById('load-method');
        const pathEl   = document.getElementById('load-path');
        if (methodEl) methodEl.value = method;
        if (pathEl)   pathEl.value   = path;
        this._updateLoadBodyVisibility();
        this._updateLoadPathParams();
        this._autofillLoadBody(opt.value, method);
    }

    _syncLoadUrl() {
        this._updateLoadBodyVisibility();
        this._updateLoadPathParams();
    }

    _updateLoadPathParams() {
        const container = document.getElementById('load-path-params');
        if (!container) return;
        const path = document.getElementById('load-path')?.value || '';
        const params = [...path.matchAll(/(?<!\{)\{([^{}]+)\}(?!\})/g)].map(m => m[1]);
        if (!params.length) { container.innerHTML = ''; return; }

        // Preserve existing input values so typing in path doesn't reset them
        const existing = {};
        container.querySelectorAll('input[data-param]').forEach(el => {
            existing[el.dataset.param] = el.value;
        });

        const fakeTags = ['{{fake.number}}','{{fake.uuid}}','{{fake.word}}','{{fake.name}}',
                          '{{fake.email}}','{{fake.date}}','{{fake.boolean}}'];
        const datalist = `<datalist id="load-pp-suggestions">${fakeTags.map(t => `<option value="${t}">`).join('')}</datalist>`;

        const rows = params.map(name => {
            const defaultVal = existing[name] ?? (/uuid|guid/.test(name.toLowerCase()) ? '{{fake.uuid}}' : '{{fake.number}}');
            return `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
                <span style="font-family:monospace;font-size:0.85rem;color:#6b7280;min-width:100px;">{${name}}</span>
                <input id="load-pp-${name}" data-param="${name}" type="text" list="load-pp-suggestions"
                       class="form-control" style="font-family:monospace;font-size:0.85rem;"
                       value="${defaultVal}" placeholder="{{fake.number}} or static value">
            </div>`;
        }).join('');

        container.innerHTML = `
            ${datalist}
            <div class="form-group" style="margin-bottom:0.75rem;">
                <label class="form-label" style="margin-bottom:0.4rem;">
                    Path Parameters
                    <span style="font-size:0.72rem;color:#9ca3af;font-weight:400;margin-left:4px;">use {{fake.xxx}} or a static value</span>
                </label>
                ${rows}
            </div>`;
    }

    async _autofillLoadBody(endpointId, method) {
        if (!['POST','PUT','PATCH'].includes((method || '').toUpperCase())) return;
        const spinner = document.getElementById('load-body-autofill-spinner');
        if (spinner) spinner.style.display = '';
        try {
            const data = await apiClient.generateFakeData(endpointId);
            const body = data.body;
            if (body && typeof body === 'object' && Object.keys(body).length > 0) {
                const placeholder = this._bodyToPlaceholders(body);
                const el = document.getElementById('load-body');
                if (el) el.value = JSON.stringify(placeholder, null, 2);
            }
        } catch (e) {
            // silently ignore — user can fill manually
        } finally {
            if (spinner) spinner.style.display = 'none';
        }
    }

    /** Convert a generated body object to {{fake.xxx}} placeholders */
    _bodyToPlaceholders(obj) {
        if (Array.isArray(obj)) return obj.map(v => this._bodyToPlaceholders(v));
        if (obj && typeof obj === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(obj)) {
                out[k] = (v && typeof v === 'object') ? this._bodyToPlaceholders(v) : this._fieldToPlaceholder(k, v);
            }
            return out;
        }
        return obj;
    }

    _fieldToPlaceholder(fieldName, value) {
        const n = (fieldName || '').toLowerCase();
        if (n.includes('email'))                          return '{{fake.email}}';
        if (n.includes('firstname') || n.includes('first_name')) return '{{fake.name}}';
        if (n.includes('lastname') || n.includes('last_name') || n.includes('surname')) return '{{fake.name}}';
        if (n.includes('fullname') || n.includes('full_name') || (n === 'name')) return '{{fake.name}}';
        if (n.includes('username') || n.includes('login'))  return '{{fake.username}}';
        if (n.includes('password') || n.includes('pwd'))    return '{{fake.password}}';
        if (n.includes('phone') || n.includes('mobile') || n.includes('cell')) return '{{fake.phone}}';
        if (n.includes('address') || n.includes('street'))  return '{{fake.address}}';
        if (n.includes('city'))                             return '{{fake.city}}';
        if (n.includes('country'))                          return '{{fake.country}}';
        if (n.includes('company') || n.includes('org'))     return '{{fake.company}}';
        if (n.includes('url') || n.includes('website') || n.includes('link')) return '{{fake.url}}';
        if (n.includes('date') || n.includes('dob'))        return '{{fake.date}}';
        if (n.includes('uuid') || n.endsWith('id'))         return '{{fake.uuid}}';
        if (n.includes('ip'))                               return '{{fake.ip}}';
        if (n.includes('color') || n.includes('colour'))    return '{{fake.color}}';
        if (typeof value === 'boolean')                     return '{{fake.boolean}}';
        if (typeof value === 'number' && !Number.isInteger(value)) return '{{fake.decimal}}';
        if (typeof value === 'number')                      return '{{fake.number}}';
        return '{{fake.word}}';
    }

    insertFakePlaceholder(fieldId, placeholder) {
        const el = document.getElementById(fieldId);
        if (!el) return;
        const start = el.selectionStart ?? el.value.length;
        const end   = el.selectionEnd   ?? el.value.length;
        el.value = el.value.slice(0, start) + placeholder + el.value.slice(end);
        el.focus();
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }

    async previewFakeData() {
        const baseUrl = document.getElementById('load-baseurl')?.value?.trim() || this.state.baseUrl;
        const method  = document.getElementById('load-method')?.value || 'GET';
        const path    = document.getElementById('load-path')?.value?.trim() || '';
        const headers = document.getElementById('load-headers')?.value?.trim() || '{}';
        const body    = document.getElementById('load-body')?.value?.trim() || '';

        // Collect path param inputs
        const pathParams = {};
        const container  = document.getElementById('load-path-params');
        if (container) {
            container.querySelectorAll('input[data-param]').forEach(el => {
                pathParams[el.dataset.param] = el.value.trim() || `{${el.dataset.param}}`;
            });
        }

        // Build URL with param values substituted (may still contain {{fake.xxx}})
        const resolvedPath = path.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (match, name) =>
            pathParams[name] !== undefined ? pathParams[name] : match
        );
        const fullUrl = resolvedPath
            ? baseUrl.replace(/\/+$/, '') + (resolvedPath.startsWith('/') ? resolvedPath : '/' + resolvedPath)
            : baseUrl;

        if (!fullUrl) { this.showToast('Enter a target URL first', 'info'); return; }

        try {
            const res = await apiClient.previewFakeData({ url: fullUrl, headers, body });

            // Pretty-print body if JSON
            let prettyBody = res.body || '(empty)';
            try { prettyBody = JSON.stringify(JSON.parse(res.body), null, 2); } catch (_) {}

            // Pretty-print headers
            let prettyHeaders = res.headers || '{}';
            try { prettyHeaders = JSON.stringify(JSON.parse(res.headers), null, 2); } catch (_) {}

            // Build path params section
            const ppRows = Object.entries(pathParams).map(([k, v]) => {
                // resolve {{fake.xxx}} tags in the value for display (already resolved server-side in the url)
                const resolved = res.url.match(new RegExp('(?<=' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/?)')) || v;
                return `<tr>
                    <td style="padding:4px 8px;font-family:monospace;color:#6b7280;">{${k}}</td>
                    <td style="padding:4px 8px;font-family:monospace;color:#111827;">${v}</td>
                </tr>`;
            }).join('');

            const codeBlock = (text, lang = '') =>
                `<pre style="background:#1e293b;color:#a3e635;padding:0.85rem;border-radius:6px;
                    font-size:0.8rem;overflow:auto;white-space:pre-wrap;margin:0;">${this._escapeHtml(text)}</pre>`;

            const section = (title, html) =>
                `<div style="margin-bottom:1.1rem;">
                    <div style="font-size:0.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;">${title}</div>
                    ${html}
                </div>`;

            const methodBadge = `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:0.75rem;
                font-weight:700;font-family:monospace;background:#dbeafe;color:#1d4ed8;">${method}</span>`;

            const content = `<div style="font-size:0.875rem;">
                ${section('Request Line',
                    `<div style="display:flex;align-items:center;gap:0.5rem;background:#f8fafc;border:1px solid #e2e8f0;
                         border-radius:6px;padding:0.6rem 0.85rem;font-family:monospace;font-size:0.85rem;word-break:break-all;">
                        ${methodBadge}
                        <span style="color:#1e293b;">${this._escapeHtml(res.url)}</span>
                    </div>`)}
                ${ppRows ? section('Path Parameters',
                    `<table style="width:100%;border-collapse:collapse;font-size:0.82rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
                        <thead><tr style="background:#f1f5f9;">
                            <th style="padding:4px 8px;text-align:left;color:#6b7280;font-weight:600;">Param</th>
                            <th style="padding:4px 8px;text-align:left;color:#6b7280;font-weight:600;">Value (template)</th>
                        </tr></thead>
                        <tbody>${ppRows}</tbody>
                    </table>`) : ''}
                ${section('Headers', codeBlock(prettyHeaders))}
                ${['POST','PUT','PATCH'].includes(method)
                    ? section('Request Body', codeBlock(prettyBody))
                    : ''}
                <p style="font-size:0.72rem;color:#9ca3af;margin:0;">
                    This is one sample resolution. Each virtual user will get different values for <code>{{fake.xxx}}</code> placeholders.
                </p>
            </div>`;

            Components.showModal('Request Preview — one sample', content,
                `<button class="btn btn-primary" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>`);
        } catch (e) {
            this.showToast('Preview failed: ' + (e.message || e), 'error');
        }
    }

    /** Clamp a number input to [min, max] in real-time and show a hint if clamped */
    _clampInput(el, min, max) {
        const raw = parseInt(el.value);
        if (isNaN(raw)) return;
        const hintEl = document.getElementById(el.id + '-hint');
        if (raw < min) {
            el.value = min;
            if (hintEl) { hintEl.textContent = `⬆ raised to min ${min}`; hintEl.style.color = '#d97706'; }
        } else if (raw > max) {
            el.value = max;
            if (hintEl) { hintEl.textContent = `⬇ lowered to max ${max}`; hintEl.style.color = '#d97706'; }
        } else {
            // Restore default hint text
            const defaults = {
                'load-vus':       'max 50',
                'load-duration':  'max 300 s (5 min)',
                'load-rampup':    'max 120 s (2 min)',
                'load-thinktime': 'min 50 ms'
            };
            if (hintEl) { hintEl.textContent = defaults[el.id] || ''; hintEl.style.color = '#9ca3af'; }
        }
    }

    _escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * Build a full URL from an endpoint path + base URL.
     * If path already starts with http(s) or {{envVar}}, it is self-contained — use as-is.
     * Otherwise prepend baseUrl (stripping any trailing slash first).
     */
    _buildUrl(path, baseUrl) {
        if (!path) return baseUrl || '';
        if (/^(https?:\/\/|\{\{)/.test(path)) return path;
        const base = (baseUrl || '').replace(/\/+$/, '');
        return base + (path.startsWith('/') ? path : '/' + path);
    }

    _confirmLoadTest({ vus, durSec, rampSec, thinkTime, url, method }) {
        return new Promise(resolve => {
            // Calculate estimated request range
            // Max: all VUs active for full duration
            const maxReqs  = Math.round(vus * durSec * 1000 / thinkTime);
            // Min: accounts for ramp-up (avg VUs during ramp = vus/2)
            const minReqs  = Math.round(vus * (durSec - rampSec / 2) * 1000 / thinkTime);
            const reqRange = minReqs === maxReqs
                ? `~${maxReqs.toLocaleString()}`
                : `~${minReqs.toLocaleString()} – ${maxReqs.toLocaleString()}`;
            const rps      = (vus / (thinkTime / 1000)).toFixed(1);

            const warningColor = maxReqs > 10000 ? '#dc2626' : maxReqs > 3000 ? '#d97706' : '#059669';
            const warningIcon  = maxReqs > 10000 ? '🔴' : maxReqs > 3000 ? '🟡' : '🟢';

            const content = `
                <div style="display:flex;flex-direction:column;gap:1rem;">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:1rem;">
                        <div style="font-size:0.8rem;color:#6b7280;margin-bottom:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Test Configuration</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.875rem;">
                            <div style="color:#6b7280;">Target</div>
                            <div style="font-family:monospace;font-weight:600;word-break:break-all;">${method} ${url}</div>
                            <div style="color:#6b7280;">Virtual Users</div>
                            <div style="font-weight:600;">${vus}</div>
                            <div style="color:#6b7280;">Duration</div>
                            <div style="font-weight:600;">${durSec}s</div>
                            <div style="color:#6b7280;">Ramp-up</div>
                            <div style="font-weight:600;">${rampSec}s</div>
                            <div style="color:#6b7280;">Think Time</div>
                            <div style="font-weight:600;">${thinkTime}ms per VU</div>
                        </div>
                    </div>

                    <div style="background:#fff;border:2px solid ${warningColor};border-radius:8px;padding:1rem;text-align:center;">
                        <div style="font-size:0.8rem;color:#6b7280;margin-bottom:0.25rem;">Estimated Requests</div>
                        <div style="font-size:2rem;font-weight:700;color:${warningColor};">${warningIcon} ${reqRange}</div>
                        <div style="font-size:0.8rem;color:#6b7280;margin-top:0.25rem;">Peak ${rps} req/s across all VUs</div>
                    </div>

                    ${maxReqs > 10000 ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:0.75rem;font-size:0.85rem;color:#dc2626;">
                        ⚠ High request volume. Ensure the target server can handle this load and that you have authorisation to run this test.
                    </div>` : ''}

                    <div style="font-size:0.85rem;color:#6b7280;text-align:center;">
                        Are you sure you want to fire this load test?
                    </div>
                </div>`;

            const actions = `
                <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML='';window._loadTestResolve(false);">Cancel</button>
                <button class="btn btn-primary" style="background:#dc2626;border-color:#dc2626;" onclick="document.getElementById('modal-container').innerHTML='';window._loadTestResolve(true);">▶ Run Load Test</button>`;

            window._loadTestResolve = resolve;
            Components.showModal('Confirm Load Test', content, actions);
        });
    }

    async startLoadTest() {
        const baseUrl  = document.getElementById('load-baseurl')?.value?.trim() || this.state.baseUrl;
        const method   = document.getElementById('load-method')?.value || 'GET';
        const path     = document.getElementById('load-path')?.value?.trim() || '';
        const headers  = document.getElementById('load-headers')?.value?.trim() || '{}';
        const body     = document.getElementById('load-body')?.value?.trim() || '';
        const vus       = Math.min(50,    Math.max(1,  parseInt(document.getElementById('load-vus')?.value)       || 10));
        const durSec    = Math.min(300,   Math.max(1,  parseInt(document.getElementById('load-duration')?.value)   || 30));
        const rampSec   = Math.min(120,   Math.max(0,  parseInt(document.getElementById('load-rampup')?.value)     || 5));
        const thinkTime = Math.min(30000, Math.max(50, parseInt(document.getElementById('load-thinktime')?.value)  || 100));
        const duration  = durSec + 's';
        const rampUp    = rampSec + 's';
        // Substitute {paramName} tokens with user-defined values from the path-param inputs
        const resolvedPath = path.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (match, name) => {
            const input = document.getElementById('load-pp-' + name);
            return input?.value?.trim() || match; // keep original if user left it blank
        });
        const url = resolvedPath ? baseUrl.replace(/\/+$/, '') + (resolvedPath.startsWith('/') ? resolvedPath : '/' + resolvedPath) : baseUrl;
        if (!url) { this.showToast('Enter a target URL', 'error'); return; }

        const config = { url, method, headers, body, virtualUsers: vus, duration, rampUp, thinkTime, certId: document.getElementById('load-cert')?.value || null };

        // Save thresholds for report
        config.thresholds = {
            p95: parseInt(document.getElementById('thresh-p95')?.value) || 500,
            errorRate: parseFloat(document.getElementById('thresh-err')?.value) || 1,
            minRps: parseFloat(document.getElementById('thresh-rps')?.value) || 10
        };

        // ── Pre-flight confirmation ───────────────────────────────────────────
        const confirmed = await this._confirmLoadTest({ vus, durSec, rampSec, thinkTime, url, method });
        if (!confirmed) return;

        try {
            const startBtn = document.getElementById('load-start-btn');
            const stopBtn  = document.getElementById('load-stop-btn');
            if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Running...'; }
            if (stopBtn)  stopBtn.style.display = '';

            const res = await apiClient.startLoadTest(config);
            this._activeLoadTestId = res.testId;
            this._loadTestConfig   = config;
            this._startLoadTestPolling();
            this._showLoadTestProgress(0, null);
        } catch (e) {
            const msg = e.message || String(e);
            const friendly = msg.includes('already running')
                ? 'A load test is already running — stop it first before starting a new one.'
                : 'Failed to start load test: ' + msg;
            this.showToast(friendly, 'error');
            const startBtn = document.getElementById('load-start-btn');
            if (startBtn) { startBtn.disabled = false; startBtn.textContent = '▶ Start Load Test'; }
        }
    }

    async stopLoadTest() {
        if (this._activeLoadTestId) {
            await apiClient.stopLoadTest(this._activeLoadTestId);
        }
        this._stopLoadTestPolling();
        this._activeLoadTestId = null;

        const startBtn = document.getElementById('load-start-btn');
        const stopBtn  = document.getElementById('load-stop-btn');
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = '▶ Start Load Test'; }
        if (stopBtn)  stopBtn.style.display = 'none';

        const resultsEl = document.getElementById('load-test-results');
        if (resultsEl) resultsEl.innerHTML = '';
    }

    _startLoadTestPolling() {
        this._stopLoadTestPolling();
        this._loadTestInterval = setInterval(async () => {
            if (!this._activeLoadTestId) return;
            try {
                const status = await apiClient.getLoadTestStatus(this._activeLoadTestId);
                this._showLoadTestProgress(status.progress || 0, status);
                if (status.status === 'completed' || status.status === 'error' || status.status === 'cancelled') {
                    this._stopLoadTestPolling();
                    const results = await apiClient.getLoadTestResults(this._activeLoadTestId);
                    this.state.loadTestResults = results;
                    this._showLoadTestResults(results);
                    const startBtn = document.getElementById('load-start-btn');
                    const stopBtn  = document.getElementById('load-stop-btn');
                    if (startBtn) { startBtn.disabled = false; startBtn.textContent = '▶ Start Load Test'; }
                    if (stopBtn)  stopBtn.style.display = 'none';
                }
            } catch (e) { /* ignore transient errors */ }
        }, 1000);
    }

    _stopLoadTestPolling() {
        if (this._loadTestInterval) { clearInterval(this._loadTestInterval); this._loadTestInterval = null; }
    }

    _showLoadTestProgress(pct, status) {
        const el = document.getElementById('load-test-results');
        if (!el) return;
        const total   = status?.totalSoFar ?? 0;
        const elapsed = status?.elapsed ?? '0ms';
        el.innerHTML = `
            <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                    <span style="font-weight:600;">Running load test…</span>
                    <span style="color:#6b7280;font-size:0.85rem;">${pct}% &nbsp;|&nbsp; ${total} requests &nbsp;|&nbsp; ${elapsed}</span>
                </div>
                <div style="background:#f1f5f9;border-radius:9999px;height:12px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#3b82f6,#6366f1);
                                border-radius:9999px;transition:width 0.5s;"></div>
                </div>
            </div>`;
    }

    _showLoadTestResults(results) {
        const el = document.getElementById('load-test-results');
        if (!el) return;
        const stats = results.stats || {};
        const cfg   = results.config || this._loadTestConfig || {};
        const thresholds = cfg.thresholds || {};

        if (results.status === 'error') {
            el.innerHTML = `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:1rem;color:#dc2626;">
                <strong>Test failed:</strong> ${results.error}</div>`;
            return;
        }

        const p95Val    = parseInt(stats.p95)    || 0;
        const errRate   = parseFloat(stats.errorRate) || 0;
        const rpsVal    = parseFloat(stats.rps)  || 0;
        const t_p95Pass = !thresholds.p95     || p95Val    <= thresholds.p95;
        const t_errPass = !thresholds.errorRate|| errRate   <= thresholds.errorRate;
        const t_rpsPass = !thresholds.minRps  || rpsVal    >= thresholds.minRps;
        const allPass   = t_p95Pass && t_errPass && t_rpsPass;

        const buckets = stats.buckets || {};
        const maxBucket = Math.max(1, ...Object.values(buckets));
        const barChart = Object.entries(buckets).map(([label, count]) => {
            const h = Math.round((count / maxBucket) * 80);
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
                <div style="font-size:0.7rem;color:#6b7280;">${count}</div>
                <div style="width:100%;height:${h}px;min-height:2px;background:#3b82f6;border-radius:3px 3px 0 0;"></div>
                <div style="font-size:0.65rem;color:#9ca3af;text-align:center;white-space:nowrap;">${label}</div>
            </div>`;
        }).join('');

        el.innerHTML = `
        <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;">
            <!-- Overall badge -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
                <h3 style="font-weight:700;">Results</h3>
                <span style="padding:4px 14px;border-radius:9999px;font-weight:700;font-size:0.875rem;
                      background:${allPass ? '#d1fae5' : '#fee2e2'};color:${allPass ? '#065f46' : '#991b1b'};">
                    ${allPass ? '✓ PASSED' : '✗ FAILED'}
                </span>
            </div>

            <!-- Stats grid -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:1.25rem;">
                ${[
                    ['Total Requests', stats.totalRequests, '#3b82f6'],
                    ['Passed',         stats.successfulRequests, '#10b981'],
                    ['Failed',         stats.failedRequests, '#ef4444'],
                    ['RPS',            stats.rps, '#6366f1'],
                    ['Avg RT',         stats.avgResponseTime, '#f59e0b'],
                    ['P50',            stats.p50, '#f59e0b'],
                    ['P95',            stats.p95, t_p95Pass ? '#10b981' : '#ef4444'],
                    ['P99',            stats.p99, '#f59e0b'],
                ].map(([label, val, color]) => `
                    <div style="text-align:center;padding:0.75rem;background:#f8fafc;border-radius:6px;border:1px solid #f1f5f9;">
                        <div style="font-size:1.2rem;font-weight:700;color:${color};">${val ?? '-'}</div>
                        <div style="font-size:0.75rem;color:#6b7280;">${label}</div>
                    </div>`).join('')}
            </div>

            <!-- Distribution chart -->
            <div style="margin-bottom:1.25rem;">
                <div style="font-weight:600;margin-bottom:0.75rem;font-size:0.875rem;">Response Time Distribution</div>
                <div style="display:flex;gap:6px;align-items:flex-end;height:100px;background:#f8fafc;
                            border-radius:6px;padding:0.75rem;">
                    ${barChart}
                </div>
            </div>

            <!-- Thresholds -->
            <div style="margin-bottom:1.25rem;">
                <div style="font-weight:600;margin-bottom:0.5rem;font-size:0.875rem;">Thresholds</div>
                <div style="display:flex;flex-direction:column;gap:0.4rem;">
                    ${[[`P95 ≤ ${thresholds.p95 ?? 500}ms`, `${p95Val}ms`, t_p95Pass],
                       [`Error rate ≤ ${thresholds.errorRate ?? 1}%`, stats.errorRate, t_errPass],
                       [`Throughput ≥ ${thresholds.minRps ?? 10} RPS`, stats.rps + ' RPS', t_rpsPass]
                    ].map(([rule, actual, pass]) => `
                        <div style="display:flex;justify-content:space-between;padding:6px 10px;
                                    border-left:3px solid ${pass ? '#10b981' : '#ef4444'};background:#f9fafb;border-radius:0 4px 4px 0;font-size:0.85rem;">
                            <span>${rule}</span>
                            <span style="font-weight:600;color:${pass ? '#059669' : '#dc2626'};">${actual} — ${pass ? '✓ Pass' : '✗ Fail'}</span>
                        </div>`).join('')}
                </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:0.75rem;">
                <button class="btn btn-primary" onclick="app.downloadLoadTestReport()">⬇ Download HTML Report</button>
                <button class="btn" style="background:#f1f5f9;color:#374151;border:1px solid #e5e7eb;"
                        onclick="app._saveLoadTestReport()">Save to Reports</button>
            </div>
        </div>`;
    }

    _saveLoadTestReport() {
        const results = this.state.loadTestResults;
        if (!results) return;
        const cfg     = results.config || this._loadTestConfig || {};
        const stats   = results.stats  || {};
        const label   = `Load Test — ${cfg.method || ''} ${cfg.url || ''}`;
        const total   = stats.totalRequests || 0;
        const passed  = stats.successfulRequests || 0;
        const workspace = (this.state.workspaces || []).find(w => w.id === this.state.activeWorkspace);
        const report  = {
            id: Date.now(),
            label,
            workspaceName: workspace ? workspace.name : 'Workspace',
            timestamp: new Date().toISOString(),
            total, passed,
            failed: total - passed,
            type: 'loadtest',
            loadTestStats: stats,
            loadTestConfig: cfg
        };
        this._persistReports(report, 'Report saved to Reports tab');
    }

    _buildLoadTestReportHtml(results) {
        const stats  = results.stats  || {};
        const cfg    = results.config || this._loadTestConfig || {};
        const ts     = new Date().toLocaleString();
        const passRate = stats.totalRequests
            ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)
            : '0.0';
        const passColor = parseFloat(passRate) >= 80 ? '#10b981' : parseFloat(passRate) >= 50 ? '#f59e0b' : '#ef4444';

        const buckets = stats.buckets || {};
        const maxBucket = Math.max(1, ...Object.values(buckets));
        const bars = Object.entries(buckets).map(([label, count]) => {
            const h = Math.round((count / maxBucket) * 140);
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
                <div style="font-size:0.75rem;color:#6b7280;">${count}</div>
                <div style="width:100%;height:${h}px;min-height:2px;background:linear-gradient(180deg,#3b82f6,#2563eb);border-radius:4px 4px 0 0;"></div>
                <div style="font-size:0.7rem;color:#9ca3af;">${label}</div>
            </div>`;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Load Test Report</title>
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;padding:2rem;color:#111827; }
.container { max-width:960px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.1);overflow:hidden; }
.header { background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:2rem; }
.header h1 { font-size:1.75rem;margin-bottom:0.4rem; }
.header p  { opacity:.85;font-size:0.875rem; }
.section   { padding:1.5rem;border-bottom:1px solid #e5e7eb; }
.grid4     { display:grid;grid-template-columns:repeat(4,1fr);gap:1rem; }
.grid2     { display:grid;grid-template-columns:repeat(2,1fr);gap:1rem; }
.card      { text-align:center;padding:1rem;border-radius:8px;border:1px solid #e5e7eb; }
.num       { font-size:1.75rem;font-weight:700;margin-bottom:4px; }
.lbl       { font-size:0.75rem;color:#6b7280; }
.thresh    { display:flex;justify-content:space-between;padding:8px 12px;border-left:4px solid;margin-bottom:6px;background:#f9fafb;border-radius:0 4px 4px 0;font-size:0.875rem; }
.footer    { padding:1rem 1.5rem;text-align:center;font-size:0.75rem;color:#9ca3af; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>⚡ Load Test Report</h1>
    <p>${cfg.method || 'GET'} ${cfg.url || ''} &nbsp;|&nbsp; Generated: ${ts}</p>
  </div>
  <div class="section">
    <h2 style="margin-bottom:1rem;font-size:1rem;">Configuration</h2>
    <div class="grid4">
      ${[['Virtual Users',cfg.virtualUsers||'-'],['Duration',cfg.duration||'-'],['Ramp-up',cfg.rampUp||'-']].map(([l,v])=>`
      <div class="card"><div class="num" style="font-size:1.2rem;">${v}</div><div class="lbl">${l}</div></div>`).join('')}
    </div>
  </div>
  <div class="section">
    <div class="grid4">
      <div class="card" style="background:#eff6ff;"><div class="num" style="color:#3b82f6;">${stats.totalRequests??'-'}</div><div class="lbl">Total Requests</div></div>
      <div class="card" style="background:#d1fae5;"><div class="num" style="color:#10b981;">${stats.successfulRequests??'-'}</div><div class="lbl">Successful</div></div>
      <div class="card" style="background:#fee2e2;"><div class="num" style="color:#ef4444;">${stats.failedRequests??'-'}</div><div class="lbl">Failed</div></div>
      <div class="card" style="background:#f1f5f9;"><div class="num" style="color:${passColor};">${passRate}%</div><div class="lbl">Pass Rate</div></div>
    </div>
  </div>
  <div class="section">
    <h2 style="margin-bottom:1rem;font-size:1rem;">Response Times</h2>
    <div class="grid4">
      ${[['Avg',stats.avgResponseTime],['P50',stats.p50],['P95',stats.p95],['P99',stats.p99],['Min',stats.minResponseTime],['Max',stats.maxResponseTime],['RPS',stats.rps],['Error Rate',stats.errorRate]].map(([l,v])=>`
      <div class="card"><div class="num" style="font-size:1.2rem;">${v??'-'}</div><div class="lbl">${l}</div></div>`).join('')}
    </div>
  </div>
  <div class="section">
    <h2 style="margin-bottom:1rem;font-size:1rem;">Response Time Distribution</h2>
    <div style="display:flex;gap:8px;align-items:flex-end;height:180px;background:#f8fafc;border-radius:8px;padding:1rem;">
      ${bars}
    </div>
  </div>
  <div class="section">
    <h2 style="margin-bottom:1rem;font-size:1rem;">Thresholds</h2>
    ${(() => {
        const t = cfg.thresholds || {};
        const p95v = parseInt(stats.p95)||0;
        const errv = parseFloat(stats.errorRate)||0;
        const rpsv = parseFloat(stats.rps)||0;
        return [
            [`P95 ≤ ${t.p95??500}ms`, `${p95v}ms`, !t.p95 || p95v <= t.p95],
            [`Error Rate ≤ ${t.errorRate??1}%`, stats.errorRate||'-', !t.errorRate || errv <= t.errorRate],
            [`Throughput ≥ ${t.minRps??10} RPS`, (stats.rps||'-') + ' RPS', !t.minRps || rpsv >= t.minRps],
        ].map(([rule,actual,pass]) => `
        <div class="thresh" style="border-color:${pass ? '#10b981' : '#ef4444'};">
            <span>${rule}</span>
            <span style="font-weight:600;color:${pass ? '#059669' : '#dc2626'};">${actual} — ${pass ? '✓ Pass' : '✗ Fail'}</span>
        </div>`).join('');
    })()}
  </div>
  <div class="footer">Generated by API Automation Tool 3.0 &nbsp;•&nbsp; ${ts}</div>
</div>
</body>
</html>`;
    }

    // Quick Test
    async sendQuickTest() {
        const method = document.getElementById('qt-method').value;
        const url = document.getElementById('qt-url').value;
        const headersText = document.getElementById('qt-headers').value;
        const body = document.getElementById('qt-body')?.value;
        const certId = document.getElementById('qt-cert')?.value || null;

        if (!url) {
            Components.showToast('Please enter a URL', 'error');
            return;
        }

        const responseContainer = document.getElementById('qt-response-container');

        try {
            responseContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="spinner"></div><p>Sending request...</p></div>';

            let headers = {};
            try { headers = headersText ? JSON.parse(headersText) : {}; } catch(e) {}

            // When a cert is selected, always route through the backend proxy
            // (browser cannot use a DB-stored client cert directly)
            const response = certId
                ? await apiClient.sendQuickRequest({ method, url, headers: JSON.stringify(headers), body, certId, forceProxy: true })
                : await apiClient.sendQuickRequest({ method, url, headers: headersText, body });

            responseContainer.innerHTML = Components.renderQuickTestResponse(response);
            Components.showToast('Request completed successfully', 'success');
        } catch (error) {
            responseContainer.innerHTML = `<div style="padding: 1rem; background: #fee2e2; border-radius: 0.5rem; color: #991b1b;"><strong>Error:</strong> ${error.message}</div>`;
            Components.showToast('Request failed', 'error');
        }
    }

    // Workspace Management
    async showNewWorkspaceModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Workspace Name *</label>
                <input type="text" id="new-workspace-name" class="form-control" placeholder="e.g., Payment Gateway API">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="new-workspace-desc" class="form-control" rows="3" placeholder="Brief description..."></textarea>
            </div>
        `;
        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
            <button class="btn btn-primary" onclick="app.createWorkspace()">Create Workspace</button>
        `;
        Components.showModal('Create New Workspace', content, actions);
    }

    async createWorkspace() {
        const name = document.getElementById('new-workspace-name').value;
        const description = document.getElementById('new-workspace-desc').value;

        if (!name) {
            Components.showToast('Workspace name is required', 'error');
            return;
        }

        try {
            const workspace = await apiClient.createWorkspace({ name, description });
            this.state.workspaces.push(workspace);
            this.state.activeWorkspace = workspace.id;
            this.updateWorkspaceSelector();
            await this.loadWorkspaceData();

            document.getElementById('modal-container').innerHTML = '';
            Components.showToast('Workspace created successfully', 'success');
        } catch (error) {
            Components.showToast('Failed to create workspace', 'error');
        }
    }

    showDeleteWorkspaceModal() {
        if (!this.state.activeWorkspace) return;
        const workspace = this.state.workspaces.find(w => w.id === this.state.activeWorkspace);
        if (!workspace) return;
        const content = `
            <div style="margin-bottom:1rem; padding:0.75rem 1rem; background:#fef2f2; border:1px solid #fecaca; border-radius:0.5rem; color:#dc2626; font-size:0.875rem;">
                ⚠️ <strong>This action is permanent and cannot be undone.</strong><br>
                All test suites, test cases, environments, secrets, swagger files, endpoints, and load test configs in this workspace will be deleted.
            </div>
            <div class="form-group">
                <label class="form-label">Type <strong>${workspace.name}</strong> to confirm</label>
                <input type="text" id="delete-workspace-confirm-name" class="form-control" placeholder="${workspace.name}" autocomplete="off">
            </div>
        `;
        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
            <button class="btn btn-danger" onclick="app.confirmDeleteWorkspace()">Delete Workspace</button>
        `;
        Components.showModal(`Delete Workspace: ${workspace.name}`, content, actions);
    }

    async confirmDeleteWorkspace() {
        const workspace = this.state.workspaces.find(w => w.id === this.state.activeWorkspace);
        if (!workspace) return;
        const typed = document.getElementById('delete-workspace-confirm-name')?.value?.trim();
        if (typed !== workspace.name) {
            Components.showToast('Workspace name does not match', 'error');
            return;
        }
        try {
            await apiClient.deleteWorkspace(workspace.id);
            this.state.workspaces = this.state.workspaces.filter(w => w.id !== workspace.id);
            document.getElementById('modal-container').innerHTML = '';
            if (this.state.workspaces.length > 0) {
                this.state.activeWorkspace = this.state.workspaces[0].id;
                this.updateWorkspaceSelector();
                await this.loadWorkspaceData();
            } else {
                this.state.activeWorkspace = null;
                this.updateWorkspaceSelector();
                this.render();
            }
            Components.showToast(`Workspace "${workspace.name}" deleted`, 'success');
        } catch (error) {
            Components.showToast('Failed to delete workspace', 'error');
        }
    }

    // Swagger Management
    showAddSwaggerModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Select File</label>
                <input type="file" id="swagger-file" class="form-control" accept=".yaml,.yml,.json">
            </div>
        `;
        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
            <button class="btn btn-primary" onclick="app.addSwagger()">Add Swagger</button>
        `;
        Components.showModal('Add Swagger Specification', content, actions);
    }

    async addSwagger() {
        const fileInput = document.getElementById('swagger-file');

        try {
            if (!fileInput || fileInput.files.length === 0) {
                Components.showToast('Please select a file', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('workspaceId', this.state.activeWorkspace);

            const swagger = await apiClient.uploadSwagger(formData);
            this.state.selectedSwaggerId = swagger.id;
            this.state.selectedEndpoint = null;

            document.getElementById('modal-container').innerHTML = '';
            await this.loadWorkspaceData();
            Components.showToast('Swagger uploaded successfully', 'success');

        } catch (error) {
            Components.showToast('Failed to add Swagger: ' + error.message, 'error');
        }
    }

    async refreshSwagger(swaggerId) {
        try {
            Components.showToast('Syncing from source...', 'info');
            const updated = await apiClient.refreshSwagger(swaggerId);
            if (updated && updated.status === 'error') {
                Components.showToast('Sync failed: could not parse swagger file', 'error');
            } else {
                // Endpoints were deleted and recreated — clear stale selected endpoint
                // loadWorkspaceData will re-match by method+path
                if (this.state.selectedEndpoint && this.state.selectedSwaggerId === swaggerId) {
                    // keep selectedEndpoint data for re-matching in loadWorkspaceData
                }
                await this.loadWorkspaceData();
                Components.showToast('Swagger synced successfully', 'success');
            }
        } catch (error) {
            console.error('Refresh swagger error:', error);
            Components.showToast('Failed to sync swagger', 'error');
        }
    }

    async deleteSwagger(swaggerId) {
        if (!confirm('Are you sure you want to delete this Swagger specification?')) return;

        try {
            await apiClient.deleteSwagger(swaggerId);
            // Clear selection state so loadWorkspaceData can re-select cleanly
            if (this.state.selectedSwaggerId === swaggerId) {
                this.state.selectedSwaggerId = null;
                this.state.selectedEndpoint = null;
            }
            await this.loadWorkspaceData();
            Components.showToast('Swagger deleted successfully', 'success');
        } catch (error) {
            Components.showToast('Failed to delete swagger', 'error');
        }
    }

    // Test Case Management
    selectEndpoint(endpointId) {
        this.state.selectedEndpoint = this.state.endpoints.find(e => e.id === endpointId);
        this.state.activeView = 'request';
        this.state.showQuickTest = false;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-request').classList.add('active');
        this.renderSidebar();
        this.render();
    }

    async runTestCase(testCaseId) {
        try {
            Components.showToast('Running test case...', 'info');
            const result = await apiClient.runTestCase(testCaseId);

            // Update cached test case status
            const testCase = this.state.testCases.find(t => t.id === testCaseId);
            if (testCase) {
                testCase.lastRunStatus = result.status;
                testCase.lastRunAt = result.executedAt;
                testCase.lastRunDuration = result.responseTime ? parseInt(result.responseTime) : null;
            }

            this.render();
            this._showTestResultModal(testCase, result);
        } catch (error) {
            Components.showToast('Test execution failed: ' + (error.message || error), 'error');
        }
    }

    _showTestResultModal(testCase, result) {
        const passed = result.status === 'passed';
        const statusColor = passed ? '#059669' : '#dc2626';
        const statusBg = passed ? '#d1fae5' : '#fee2e2';

        // Parse assertions JSON
        let assertions = [];
        try { assertions = result.assertions ? JSON.parse(result.assertions) : []; } catch (e) {}

        // Parse response body
        let bodyDisplay = result.response || result.error || '';
        try {
            bodyDisplay = JSON.stringify(JSON.parse(bodyDisplay), null, 2);
        } catch (e) {}

        const assertionsHtml = assertions.length === 0
            ? '<p style="color:#9ca3af;font-size:0.85rem;">No assertions defined.</p>'
            : `<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                <thead><tr style="background:#f9fafb;">
                    <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb;">Field / Rule</th>
                    <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb;">Detail</th>
                    <th style="text-align:center;padding:6px 8px;border-bottom:1px solid #e5e7eb;">Result</th>
                </tr></thead>
                <tbody>
                    ${assertions.map(a => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:6px 8px;">${a.name || '-'}</td>
                            <td style="padding:6px 8px;color:#6b7280;">${a.detail || ''}</td>
                            <td style="text-align:center;padding:6px 8px;">
                                <span style="font-weight:600;color:${a.passed ? '#059669' : '#dc2626'};">${a.passed ? '✓ Pass' : '✗ Fail'}</span>
                            </td>
                        </tr>`).join('')}
                </tbody>
               </table>`;

        const content = `
            <!-- Status banner -->
            <div style="display:flex;align-items:center;gap:1rem;padding:1rem;border-radius:8px;background:${statusBg};margin-bottom:1.25rem;">
                <span style="font-size:2rem;">${passed ? '✅' : '❌'}</span>
                <div>
                    <div style="font-size:1.1rem;font-weight:700;color:${statusColor};">${passed ? 'Test Passed' : 'Test Failed'}</div>
                    <div style="font-size:0.85rem;color:#6b7280;">${testCase ? testCase.name : 'Test Case'}</div>
                </div>
                <div style="margin-left:auto;display:flex;gap:1.5rem;text-align:center;">
                    <div>
                        <div style="font-size:1.25rem;font-weight:700;">${result.statusCode ?? '-'}</div>
                        <div style="font-size:0.75rem;color:#6b7280;">HTTP Status</div>
                    </div>
                    <div>
                        <div style="font-size:1.25rem;font-weight:700;">${result.responseTime ?? '-'}</div>
                        <div style="font-size:0.75rem;color:#6b7280;">Response Time</div>
                    </div>
                </div>
            </div>

            <!-- Assertions -->
            <div style="margin-bottom:1.25rem;">
                <div style="font-weight:600;margin-bottom:0.5rem;">Assertions</div>
                ${assertionsHtml}
            </div>

            <!-- Response body -->
            <div>
                <div style="font-weight:600;margin-bottom:0.5rem;">Response Body</div>
                ${result.error
                    ? `<div style="color:#dc2626;background:#fee2e2;padding:0.75rem;border-radius:6px;font-size:0.85rem;">${result.error}</div>`
                    : `<pre style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:0.75rem;font-size:0.8rem;max-height:250px;overflow:auto;white-space:pre-wrap;word-break:break-all;">${bodyDisplay || '(empty)'}</pre>`
                }
            </div>
        `;

        // Stash for save button (avoids inline JSON escaping issues)
        this._pendingReportEntries = [{
            name: testCase ? testCase.name : 'Test Case',
            method: testCase ? testCase.method : '',
            endpoint: testCase ? this._buildUrl(testCase.endpoint || '', testCase.baseUrl) : '',
            status: result.status,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            response: bodyDisplay,
            assertions,
            error: result.error || null
        }];
        this._pendingReportLabel = testCase ? testCase.name : 'Test Case';

        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
            <button class="btn" style="background:#f1f5f9;color:#374151;border:1px solid #e5e7eb;" onclick="app.saveReport(app._pendingReportEntries, app._pendingReportLabel, true)">Save to Reports</button>
        `;
        Components.showModal(`Test Result — ${passed ? 'PASSED' : 'FAILED'}`, content, actions);
    }

    /**
     * Save current request as test case
     */
    async saveAsTestCase() {
        try {
            // Gather all data from request builder
            const requestData = this.gatherRequestData();
            this._pendingSaveData = requestData;

            // Show modal
            Components.showSaveAsTestCaseModal(requestData);

        } catch (error) {
            console.error('Failed to prepare save test case:', error);
            this.showToast(' Failed to prepare test case', 'error');
        }
    }

    /**
     * Gather all request data from the UI
     */
    gatherRequestData() {
        const method = document.getElementById('request-method')?.value || 'GET';
        const endpoint = document.getElementById('request-url')?.value || '';

        // Gather params
        const params = {};
        const paramRows = document.querySelectorAll('#params-list .kv-row');
        paramRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            const key = inputs[0]?.value.trim();
            const value = inputs[1]?.value.trim();
            if (key) {
                params[key] = value;
            }
        });

        // Gather headers
        const headers = {};
        const headerRows = document.querySelectorAll('#headers-list .kv-row');
        headerRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            const key = inputs[0]?.value.trim();
            const value = inputs[1]?.value.trim();
            if (key) {
                headers[key] = value;
            }
        });

        // Gather body
        let body = null;
        const bodyType = document.getElementById('body-type')?.value;
        if (bodyType === 'json' || bodyType === 'raw') {
            const bodyTextarea = document.getElementById('request-body');
            if (bodyTextarea && bodyTextarea.value.trim()) {
                try {
                    body = JSON.parse(bodyTextarea.value);
                } catch (e) {
                    body = bodyTextarea.value; // Keep as string if not valid JSON
                }
            }
        }

        // Generate suggested name
        const suggestedName = this.generateTestCaseName(method, endpoint);

        return {
            method,
            endpoint,
            params: Object.keys(params).length > 0 ? params : null,
            headers: Object.keys(headers).length > 0 ? headers : null,
            body,
            suggestedName,
            description: '',
            swaggerFileId: this.state.selectedSwaggerId,
            endpointId: this.state.selectedEndpoint?.id
        };
    }

    /**
     * Gather request data from Quick Test panel fields
     */
    gatherQuickTestData() {
        const method   = document.getElementById('qt-method')?.value || 'GET';
        const endpoint = document.getElementById('qt-url')?.value?.trim() || '';

        let headers = null;
        try {
            const raw = document.getElementById('qt-headers')?.value?.trim();
            if (raw) headers = JSON.parse(raw);
        } catch (e) {}

        let body = null;
        try {
            const raw = document.getElementById('qt-body')?.value?.trim();
            if (raw) {
                try { body = JSON.parse(raw); } catch (e) { body = raw; }
            }
        } catch (e) {}

        const suggestedName = this.generateTestCaseName(method, endpoint);

        return {
            method,
            endpoint,
            params:       null,
            headers:      headers && Object.keys(headers).length > 0 ? headers : null,
            body,
            suggestedName,
            description:  '',
            swaggerFileId: null,
            endpointId:    null
        };
    }

    saveQuickTestAsTestCase() {
        const requestData = this.gatherQuickTestData();
        if (!requestData.endpoint) {
            this.showToast('Enter a URL before saving as test case', 'error');
            return;
        }
        this._pendingSaveData = requestData;
        Components.showSaveAsTestCaseModal(requestData);
    }

    /**
     * Generate test case name from method and endpoint
     */
    generateTestCaseName(method, endpoint) {
        // Extract last part of endpoint
        const parts = endpoint.split('/').filter(p => p && !p.startsWith('{'));
        const resource = parts[parts.length - 1] || 'request';

        // Capitalize
        const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);

        return `${method} ${resourceName}`;
    }

    /**
     * Load test suites for dropdown
     */
    async loadTestSuitesForDropdown(workspaceId) {
        try {
            const suites = await apiClient.getTestSuites(workspaceId);

            const select = document.getElementById('test-suite-select');
            if (!select) return;

            if (suites.length === 0) {
                select.innerHTML = '<option value="">No test suites available - Create one</option>';
            } else {
                select.innerHTML = suites.map((suite, i) =>
                    `<option value="${suite.id}" ${i === 0 ? 'selected' : ''}>${this.getTypeEmoji(suite.type)} ${suite.name}</option>`
                ).join('');
            }

        } catch (error) {
            console.error('Failed to load test suites:', error);
            const select = document.getElementById('test-suite-select');
            if (select) {
                select.innerHTML = '<option value="">Error loading test suites</option>';
            }
        }
    }

    /**
     * Get emoji for suite type
     */
    getTypeEmoji(type) {
        const emojis = {
            'regression': '🔄',
            'smoke': '💨',
            'integration': '🔗',
            'positive': '✅',
            'negative': '',
            'custom': '📋'
        };
        return emojis[type] || '📋';
    }

    /**
     * Show create test suite modal (from save test case flow)
     */
    showCreateTestSuiteModal() {
        Components.showCreateTestSuiteModal();
    }

    /**
     * Confirm create test suite
     */
    async confirmCreateTestSuite() {
        const name = document.getElementById('new-suite-name')?.value.trim();
        const description = document.getElementById('new-suite-description')?.value.trim();
        const type = document.getElementById('new-suite-type')?.value;

        if (!name) {
            this.showToast(' Please enter a suite name', 'error');
            return;
        }

        try {
            const suiteData = {
                workspaceId: this.state.activeWorkspace,
                name,
                description,
                type,
                swaggerFileId: this.state.selectedSwaggerId || null
            };

            const newSuite = await apiClient.createTestSuite(suiteData);

            this.showToast(' Test suite created successfully!', 'success');

            // Close create suite modal and go back to save test case modal
            document.getElementById('modal-container').innerHTML = '';

            // Re-open save test case modal (use stored snapshot so Quick Test data is preserved)
            Components.showSaveAsTestCaseModal(this._pendingSaveData || this.gatherRequestData());

            // Select the newly created suite
            setTimeout(() => {
                const select = document.getElementById('test-suite-select');
                if (select) {
                    select.value = newSuite.id;
                }
            }, 100);

        } catch (error) {
            console.error('Failed to create test suite:', error);
            this.showToast(' Failed to create test suite', 'error');
        }
    }

    /**
     * Cancel create suite (go back to save test case modal)
     */
    cancelCreateSuite() {
        document.getElementById('modal-container').innerHTML = '';
        Components.showSaveAsTestCaseModal(this._pendingSaveData || this.gatherRequestData());
    }

    /**
     * Confirm save test case
     */
    async confirmSaveTestCase() {
        const suiteId = document.getElementById('test-suite-select')?.value;
        const name = document.getElementById('test-case-name')?.value.trim();
        const description = document.getElementById('test-case-description')?.value.trim();
        const expectedStatus = parseInt(document.getElementById('expected-status')?.value) || 200;

        // Validation
        if (!suiteId) {
            this.showToast(' Please select a test suite', 'error');
            return;
        }

        if (!name) {
            this.showToast(' Please enter a test case name', 'error');
            return;
        }

        try {
            // Use stored snapshot (works for both Request Builder and Quick Test sources)
            const requestData = this._pendingSaveData || this.gatherRequestData();

            // Collect path params from modal inputs
            const pathParamMatches = (requestData.endpoint || '').match(/(?<!\{)\{([^{}]+)\}(?!\})/g) || [];
            const pathParamsObj = {};
            pathParamMatches.forEach(p => {
                const paramName = p.slice(1, -1);
                const el = document.getElementById(`path-param-${paramName}`);
                if (el && el.value.trim()) pathParamsObj[paramName] = el.value.trim();
            });

            // Prepare test case data
            const testCaseData = {
                suiteId,
                workspaceId: this.state.activeWorkspace,
                name,
                description,
                method: requestData.method,
                endpoint: requestData.endpoint,
                params: requestData.params,
                headers: requestData.headers,
                body: requestData.body,
                expectedStatus,
                swaggerFileId: requestData.swaggerFileId,
                endpointId: requestData.endpointId,
                pathParams: Object.keys(pathParamsObj).length > 0 ? JSON.stringify(pathParamsObj) : null
            };

            // Show loading
            const saveButton = document.querySelector('#modal-container .btn-primary');
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.innerHTML = ' Saving...';
            }

            // Save
            const response = await apiClient.saveRequestAsTestCase(testCaseData);

            if (response.success) {
                this.showToast('Test case saved successfully!', 'success');
                this._pendingSaveData = null;

                // Close modal
                document.getElementById('modal-container').innerHTML = '';

                // Update in-memory state so the Test Cases tab reflects it immediately
                this.state.testCases = await apiClient.getTestCases(this.state.activeWorkspace);

            } else {
                throw new Error(response.error || 'Failed to save test case');
            }

        } catch (error) {
            console.error('Failed to save test case:', error);
            this.showToast(' Failed to save test case: ' + error.message, 'error');

            // Re-enable button
            const saveButton = document.querySelector('#modal-container .btn-primary');
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = '💾 Save Test Case';
            }
        }
    }

    async runAllTests() {
        try {
            Components.showToast('Running all test cases...', 'info');
            const results = await apiClient.runAllTests(this.state.activeWorkspace);
            await this.loadWorkspaceData();
            this._showRunSummaryModal(results, 'All Tests');
        } catch (error) {
            Components.showToast('Test execution failed', 'error');
        }
    }

    async runAllTestsInSuite(suiteId) {
        const id = suiteId || this.state.selectedSuiteId;
        if (!id) {
            Components.showToast('No suite selected', 'error');
            return;
        }

        // Fetch test cases for this suite
        let testCases;
        try {
            testCases = await apiClient.getTestCasesBySuite(id);
        } catch (e) {
            Components.showToast('Failed to load test cases', 'error');
            return;
        }
        if (testCases.length === 0) {
            Components.showToast('No test cases in this suite', 'info');
            return;
        }

        const suite = this.state.testSuites.find(s => s.id === id);

        // Init progress state
        if (!this.state.suiteRunProgress) this.state.suiteRunProgress = {};
        this.state.suiteRunProgress[id] = {
            total: testCases.length,
            completed: 0,
            passed: 0,
            failed: 0,
            running: true,
            suiteName: suite?.name || 'Suite',
            currentTestName: ''
        };
        this._updateSuiteRunIndicator(id);
        this._renderProgressBar(id);

        const results = [];
        for (const tc of testCases) {
            const prog = this.state.suiteRunProgress[id];
            prog.currentTestName = tc.name;
            this._updateProgressBar(id);
            this._updateTestCardStatus(tc.id, 'running');

            try {
                const result = await apiClient.runTestCase(tc.id);
                results.push(result);
                if (result.status === 'passed') prog.passed++;
                else prog.failed++;
                this._updateTestCardStatus(tc.id, result.status);
            } catch (e) {
                results.push({ testCaseId: tc.id, status: 'failed', error: e.message });
                prog.failed++;
                this._updateTestCardStatus(tc.id, 'failed');
            }
            prog.completed++;
            this._updateProgressBar(id);
            this._updateSuiteRunIndicator(id);
        }

        // Mark done
        this.state.suiteRunProgress[id].running = false;
        this.state.suiteRunProgress[id].currentTestName = 'Done';
        this._updateProgressBar(id);
        this._updateSuiteRunIndicator(id);

        // Brief pause so user sees 100%, then clean up
        await new Promise(r => setTimeout(r, 1200));
        delete this.state.suiteRunProgress[id];
        this._removeProgressBar(id);
        this._updateSuiteRunIndicator(id);

        // Refresh test cases & show summary (pass local testCases so body is never null)
        await this.selectTestSuite(id);
        this._showRunSummaryModal(results, suite?.name || 'Suite', testCases);
    }

    _renderProgressBar(suiteId) {
        const container = document.getElementById('tc-progress-container');
        if (!container) return;
        const prog = this.state.suiteRunProgress?.[suiteId];
        if (!prog) return;
        const el = document.createElement('div');
        el.id = `suite-progress-${suiteId}`;
        el.className = 'suite-progress-wrap';
        el.innerHTML = this._progressBarHtml(suiteId, prog);
        container.prepend(el);
    }

    _updateProgressBar(suiteId) {
        const el = document.getElementById(`suite-progress-${suiteId}`);
        if (!el) return;
        const prog = this.state.suiteRunProgress?.[suiteId];
        if (!prog) { el.remove(); return; }
        el.innerHTML = this._progressBarHtml(suiteId, prog);
    }

    _removeProgressBar(suiteId) {
        document.getElementById(`suite-progress-${suiteId}`)?.remove();
    }

    _progressBarHtml(suiteId, prog) {
        const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
        const passedPct = prog.total > 0 ? (prog.passed / prog.total) * 100 : 0;
        const failedPct = prog.total > 0 ? (prog.failed / prog.total) * 100 : 0;
        const isDone = !prog.running;
        return `
            <div class="suite-progress-header">
                <span style="font-weight:600;">${prog.suiteName}</span>
                <span style="font-size:0.8rem; color:#6b7280;">${prog.completed} / ${prog.total} &nbsp;·&nbsp;
                    <span style="color:#16a34a;">✓ ${prog.passed}</span> &nbsp;
                    <span style="color:#dc2626;">✗ ${prog.failed}</span>
                </span>
            </div>
            <div class="suite-progress-track">
                <div class="suite-progress-passed" style="width:${passedPct}%"></div>
                <div class="suite-progress-failed" style="width:${failedPct}%"></div>
            </div>
            <div class="suite-progress-label">
                ${isDone
                    ? `<span style="color:#16a34a; font-weight:600;">✓ Completed</span>`
                    : `<span class="suite-progress-spinner"></span> ${prog.currentTestName}`}
            </div>
        `;
    }

    _updateSuiteRunIndicator(suiteId) {
        const el = document.getElementById(`suite-run-indicator-${suiteId}`);
        if (!el) return;
        const prog = this.state.suiteRunProgress?.[suiteId];
        if (!prog) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = prog.running
            ? `<span class="suite-run-badge running"><span class="suite-progress-spinner"></span>${prog.completed}/${prog.total}</span>`
            : `<span class="suite-run-badge done">✓ Done</span>`;
    }

    _updateTestCardStatus(tcId, status) {
        const el = document.getElementById(`tc-status-${tcId}`);
        if (!el) return;
        if (status === 'running') {
            el.innerHTML = `<span class="suite-progress-spinner" style="display:inline-block; width:16px; height:16px;"></span>`;
        } else {
            el.innerHTML = status === 'passed' ? '✅' : '❌';
        }
    }

    _showRunSummaryModal(results, label, tcArray = null) {
        if (!results || results.length === 0) {
            Components.showToast('No tests to run', 'info');
            return;
        }
        const passed = results.filter(r => r.status === 'passed').length;
        const failed = results.length - passed;
        const allPassed = failed === 0;

        // Prefer the locally-fetched array (has full body data); fall back to state
        const tcMap = {};
        (tcArray || this.state.testCases || []).forEach(tc => { tcMap[tc.id] = tc; });

        // Normalize entries — include full request details from the test case
        const entries = results.map(r => {
            const tc = tcMap[r.testCaseId] || {};
            let assertions = [];
            try { assertions = r.assertions ? JSON.parse(r.assertions) : []; } catch (e) {}
            let pathParams = {};
            try { pathParams = tc.pathParams ? JSON.parse(tc.pathParams) : {}; } catch (e) {}
            let headers = {};
            try { headers = tc.headers ? JSON.parse(tc.headers) : {}; } catch (e) {}

            const ep = tc.endpoint || '';
            const fullEndpoint = this._buildUrl(ep, tc.baseUrl);

            // Build displayed URL with path params substituted for clarity
            const displayUrl = fullEndpoint.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (m, k) =>
                pathParams[k] !== undefined ? String(pathParams[k]) : m
            );

            return {
                name:        tc.name || String(r.testCaseId),
                method:      tc.method || '',
                displayUrl,
                headers,
                body:        tc.body || '',
                pathParams,
                status:      r.status,
                statusCode:  r.statusCode,
                responseTime: r.responseTime,
                response:    r.response || '',
                assertions,
                error:       r.error || null
            };
        });

        // Stash for Save button
        this._pendingReportEntries = entries;
        this._pendingReportLabel  = label;

        const rows = this._renderReportEntryRows(entries);

        const content = `
            <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;">
                <div style="flex:1;padding:0.85rem;border-radius:8px;background:#d1fae5;text-align:center;">
                    <div style="font-size:1.75rem;font-weight:700;color:#059669;">${passed}</div>
                    <div style="font-size:0.75rem;color:#059669;">Passed</div>
                </div>
                <div style="flex:1;padding:0.85rem;border-radius:8px;background:#fee2e2;text-align:center;">
                    <div style="font-size:1.75rem;font-weight:700;color:#dc2626;">${failed}</div>
                    <div style="font-size:0.75rem;color:#dc2626;">Failed</div>
                </div>
                <div style="flex:1;padding:0.85rem;border-radius:8px;background:#f1f5f9;text-align:center;">
                    <div style="font-size:1.75rem;font-weight:700;color:#334155;">${results.length}</div>
                    <div style="font-size:0.75rem;color:#6b7280;">Total</div>
                </div>
                <div style="flex:1;padding:0.85rem;border-radius:8px;background:#f1f5f9;text-align:center;">
                    <div style="font-size:1.75rem;font-weight:700;color:#334155;">${Math.round(passed/results.length*100)}%</div>
                    <div style="font-size:0.75rem;color:#6b7280;">Pass Rate</div>
                </div>
            </div>
            <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:0.6rem;">Click a row to expand request &amp; response details</div>
            ${rows}
        `;

        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
            <button class="btn" style="background:#f1f5f9;color:#374151;border:1px solid #e5e7eb;"
                onclick="app.saveReport(app._pendingReportEntries, app._pendingReportLabel, true)">Save to Reports</button>
        `;
        Components.showModal(`Run Report — ${label} (${allPassed ? 'ALL PASSED' : failed + ' FAILED'})`, content, actions);
    }

    /** Shared helper — renders expandable <details> rows for a normalized entries array */
    _renderReportEntryRows(entries) {
        const esc = s => this._escapeHtml(s);
        const codeBox = text =>
            `<pre style="margin:0;padding:0.6rem 0.75rem;background:#1e293b;color:#a3e635;
                border-radius:5px;font-size:0.75rem;white-space:pre-wrap;overflow:auto;max-height:160px;">${esc(text)}</pre>`;
        const subLabel = txt =>
            `<div style="font-size:0.68rem;font-weight:700;color:#9ca3af;text-transform:uppercase;
                letter-spacing:0.05em;margin-bottom:3px;">${txt}</div>`;

        return entries.map(e => {
            const passColor = e.status === 'passed' ? '#059669' : '#dc2626';
            const passBg    = e.status === 'passed' ? '#d1fae5' : '#fee2e2';
            const badge     = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;
                font-weight:700;background:${passBg};color:${passColor};">${e.status === 'passed' ? '✓ Pass' : '✗ Fail'}</span>`;

            const mColors = {GET:'#dbeafe/#1d4ed8',POST:'#dcfce7/#15803d',PUT:'#fef9c3/#a16207',
                             DELETE:'#fee2e2/#b91c1c',PATCH:'#ede9fe/#6d28d9'};
            const [mbg, mfg] = (mColors[e.method] || '#f1f5f9/#374151').split('/');
            const methodBadge = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:0.7rem;
                font-weight:700;font-family:monospace;background:${mbg};color:${mfg};">${esc(e.method)}</span>`;

            const ppEntries = Object.entries(e.pathParams || {});
            const ppTable = ppEntries.length ? `
                ${subLabel('Path Parameters')}
                <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-bottom:0.5rem;">
                    ${ppEntries.map(([k, v]) =>
                        `<tr><td style="padding:2px 6px;color:#6b7280;font-family:monospace;">{${esc(k)}}</td>
                             <td style="padding:2px 6px;font-family:monospace;color:#111;">${esc(String(v))}</td></tr>`
                    ).join('')}
                </table>` : '';

            const headersObj = typeof e.headers === 'object' ? e.headers : {};
            const headersStr = Object.keys(headersObj).length ? JSON.stringify(headersObj, null, 2) : '';

            let prettyBody = e.body || '';
            try { prettyBody = prettyBody ? JSON.stringify(JSON.parse(prettyBody), null, 2) : ''; } catch (_) {}

            let prettyResponse = e.response || '';
            try { prettyResponse = prettyResponse ? JSON.stringify(JSON.parse(prettyResponse), null, 2) : ''; } catch (_) {}

            const assertRows = (e.assertions || []).map(a =>
                `<tr>
                    <td style="padding:2px 6px;">${a.passed ? '✅' : '❌'}</td>
                    <td style="padding:2px 6px;font-size:0.78rem;">${esc(a.name || '')}</td>
                    <td style="padding:2px 6px;font-size:0.75rem;color:#6b7280;">${esc(a.detail || '')}</td>
                </tr>`
            ).join('');

            const displayUrl = e.displayUrl || e.endpoint || '';

            const requestSection = `
                <div style="margin-bottom:0.6rem;">
                    ${subLabel('Request')}
                    <div style="display:flex;align-items:center;gap:0.4rem;font-family:monospace;font-size:0.8rem;
                         background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:5px 8px;margin-bottom:0.4rem;word-break:break-all;">
                        ${methodBadge} <span>${esc(displayUrl)}</span>
                    </div>
                    ${ppTable}
                    ${headersStr ? subLabel('Headers') + codeBox(headersStr) : ''}
                    ${prettyBody ? `<div style="margin-top:0.4rem;">${subLabel('Request Body')}${codeBox(prettyBody)}</div>` : ''}
                </div>`;

            const responseSection = `
                <div style="margin-bottom:0.6rem;">
                    ${subLabel('Response')}
                    ${e.error
                        ? `<div style="color:#dc2626;font-size:0.8rem;padding:4px 0;">${esc(e.error)}</div>`
                        : (prettyResponse ? codeBox(prettyResponse) : '<span style="font-size:0.78rem;color:#9ca3af;">empty</span>')}
                </div>`;

            const assertSection = assertRows ? `
                <div>${subLabel('Assertions')}
                    <table style="width:100%;border-collapse:collapse;">${assertRows}</table>
                </div>` : '';

            const borderColor = e.status === 'passed' ? '#10b981' : '#ef4444';
            return `
            <details style="border:1px solid #e5e7eb;border-left:3px solid ${borderColor};
                border-radius:6px;margin-bottom:0.5rem;overflow:hidden;">
                <summary style="display:flex;align-items:center;gap:0.6rem;padding:9px 10px;
                    cursor:pointer;background:#f9fafb;list-style:none;user-select:none;
                    -webkit-appearance:none;" onclick="">
                    <span class="report-chevron" style="font-size:0.65rem;color:#9ca3af;
                        transition:transform 0.15s;flex-shrink:0;">▶</span>
                    <span style="flex:1;font-weight:500;font-size:0.875rem;white-space:nowrap;
                        overflow:hidden;text-overflow:ellipsis;">${esc(e.name)}</span>
                    <span style="font-family:monospace;font-size:0.75rem;color:#6b7280;
                        white-space:nowrap;">${methodBadge} ${esc(displayUrl.split('?')[0])}</span>
                    ${badge}
                    <span style="color:#6b7280;font-size:0.78rem;min-width:40px;text-align:right;white-space:nowrap;">${e.statusCode ?? '-'}</span>
                    <span style="color:#9ca3af;font-size:0.75rem;min-width:48px;text-align:right;white-space:nowrap;">${e.responseTime ?? '-'}</span>
                </summary>
                <div style="padding:0.75rem 1rem;background:white;border-top:1px solid #f1f5f9;">
                    ${requestSection}${responseSection}${assertSection}
                </div>
            </details>`;
        }).join('');
    }

    viewSavedReport(reportId) {
        const report = this.state.savedReports.find(r => r.id === reportId);
        if (!report) return;

        const meta = `<div style="font-size:0.78rem;color:#6b7280;margin-bottom:0.75rem;">
            ${this._escapeHtml(report.workspaceName)} &nbsp;•&nbsp; ${new Date(report.timestamp).toLocaleString()}
        </div>`;

        let content;
        if (report.type === 'loadtest') {
            const s   = report.loadTestStats  || {};
            const cfg = report.loadTestConfig || {};
            const pr  = s.totalRequests ? ((s.successfulRequests / s.totalRequests) * 100).toFixed(1) : '0.0';
            const pc  = parseFloat(pr) >= 80 ? '#059669' : parseFloat(pr) >= 50 ? '#d97706' : '#dc2626';
            const stat = (label, val, color = '#334155') =>
                `<div style="flex:1;padding:0.85rem;border-radius:8px;background:#f1f5f9;text-align:center;">
                    <div style="font-size:1.4rem;font-weight:700;color:${color};">${val}</div>
                    <div style="font-size:0.75rem;color:#6b7280;">${label}</div>
                </div>`;
            content = `${meta}
                <div style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap;">
                    ${stat('Total Requests', s.totalRequests ?? '-')}
                    ${stat('Successful', s.successfulRequests ?? '-', '#059669')}
                    ${stat('Failed', (s.totalRequests ?? 0) - (s.successfulRequests ?? 0), '#dc2626')}
                    ${stat('Pass Rate', pr + '%', pc)}
                </div>
                <div style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap;">
                    ${stat('Avg (ms)', s.avgResponseTime ?? '-')}
                    ${stat('P95 (ms)', s.p95ResponseTime ?? '-')}
                    ${stat('Min (ms)', s.minResponseTime ?? '-')}
                    ${stat('Max (ms)', s.maxResponseTime ?? '-')}
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0.75rem;font-size:0.82rem;">
                    <div><strong>URL:</strong> <span style="font-family:monospace;">${this._escapeHtml(cfg.url || '-')}</span></div>
                    <div><strong>Method:</strong> ${this._escapeHtml(cfg.method || '-')} &nbsp;
                         <strong>VUs:</strong> ${cfg.virtualUsers ?? '-'} &nbsp;
                         <strong>Duration:</strong> ${this._escapeHtml(cfg.duration || '-')} &nbsp;
                         <strong>Ramp-up:</strong> ${this._escapeHtml(cfg.rampUp || '-')}</div>
                </div>`;
        } else if (report.type === 'datadriven') {
            const passRate = report.total > 0 ? Math.round(report.passed / report.total * 100) : 0;
            const varKeys = [...new Set((report.rows || []).flatMap(r => Object.keys(r.variables || {})))];
            const stat = (label, val, bg, color) =>
                `<div style="flex:1;padding:0.85rem;border-radius:8px;background:${bg};text-align:center;">
                    <div style="font-size:1.75rem;font-weight:700;color:${color};">${val}</div>
                    <div style="font-size:0.75rem;color:${color};">${label}</div>
                </div>`;
            const rowsHtml = (report.rows || []).map(r => {
                const rowBg = r.passed ? '#f0fdf4' : (r.error ? '#fff7ed' : '#fef2f2');
                const assertList = (r.assertions || []).map(a =>
                    `<div style="color:${a.passed ? '#059669' : '#dc2626'};font-size:0.78rem;">
                        ${a.passed ? '✓' : '✗'} ${this._escapeHtml(a.name || '')}: ${this._escapeHtml(a.detail || '')}
                    </div>`).join('');
                return `<tr style="background:${rowBg};border-bottom:1px solid #e5e7eb;">
                    <td style="padding:7px 10px;font-weight:600;">#${r.row}</td>
                    ${varKeys.map(k => `<td style="padding:7px 10px;font-family:monospace;font-size:0.8rem;">${this._escapeHtml((r.variables || {})[k] || '')}</td>`).join('')}
                    <td style="padding:7px 10px;text-align:center;font-weight:600;">${r.actualStatus}</td>
                    <td style="padding:7px 10px;text-align:center;color:#6b7280;">${r.expectedStatus}</td>
                    <td style="padding:7px 10px;text-align:center;color:#6b7280;">${r.responseTime || ''}</td>
                    <td style="padding:7px 10px;">${assertList || '<span style="color:#9ca3af;">—</span>'}</td>
                    <td style="padding:7px 10px;text-align:center;">
                        ${r.error ? `<span style="color:#ea580c;" title="${this._escapeHtml(r.error)}">⚠ Error</span>`
                            : r.passed ? '<span style="color:#059669;font-weight:600;">✅ Pass</span>'
                                       : '<span style="color:#dc2626;font-weight:600;">❌ Fail</span>'}
                    </td>
                </tr>`;
            }).join('');
            content = `${meta}
                <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;">
                    ${stat('Passed',    report.passed,          '#d1fae5', '#059669')}
                    ${stat('Failed',    report.failed,          '#fee2e2', '#dc2626')}
                    ${stat('Total',     report.total,           '#f1f5f9', '#334155')}
                    ${stat('Pass Rate', passRate + '%',         '#f1f5f9', '#334155')}
                </div>
                ${report.testCaseName ? `<div style="font-size:0.82rem;color:#6b7280;margin-bottom:0.5rem;">Test Case: <strong>${this._escapeHtml(report.testCaseName)}</strong></div>` : ''}
                ${report.fileName ? `<div style="font-size:0.82rem;color:#6b7280;margin-bottom:0.75rem;">File: <code>${this._escapeHtml(report.fileName)}</code></div>` : ''}
                <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                    <thead><tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
                        <th style="padding:8px 10px;text-align:left;">Row</th>
                        ${varKeys.map(k => `<th style="padding:8px 10px;text-align:left;">${this._escapeHtml(k)}</th>`).join('')}
                        <th style="padding:8px 10px;text-align:center;">Status</th>
                        <th style="padding:8px 10px;text-align:center;">Expected</th>
                        <th style="padding:8px 10px;text-align:center;">Time</th>
                        <th style="padding:8px 10px;text-align:left;">Assertions</th>
                        <th style="padding:8px 10px;text-align:center;">Result</th>
                    </tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table></div>`;
        } else {
            const passRate = report.total > 0 ? Math.round(report.passed / report.total * 100) : 0;
            const rows = this._renderReportEntryRows(report.entries || []);
            content = `${meta}
                <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;">
                    <div style="flex:1;padding:0.85rem;border-radius:8px;background:#d1fae5;text-align:center;">
                        <div style="font-size:1.75rem;font-weight:700;color:#059669;">${report.passed}</div>
                        <div style="font-size:0.75rem;color:#059669;">Passed</div>
                    </div>
                    <div style="flex:1;padding:0.85rem;border-radius:8px;background:#fee2e2;text-align:center;">
                        <div style="font-size:1.75rem;font-weight:700;color:#dc2626;">${report.failed}</div>
                        <div style="font-size:0.75rem;color:#dc2626;">Failed</div>
                    </div>
                    <div style="flex:1;padding:0.85rem;border-radius:8px;background:#f1f5f9;text-align:center;">
                        <div style="font-size:1.75rem;font-weight:700;color:#334155;">${report.total}</div>
                        <div style="font-size:0.75rem;color:#6b7280;">Total</div>
                    </div>
                    <div style="flex:1;padding:0.85rem;border-radius:8px;background:#f1f5f9;text-align:center;">
                        <div style="font-size:1.75rem;font-weight:700;color:#334155;">${passRate}%</div>
                        <div style="font-size:0.75rem;color:#6b7280;">Pass Rate</div>
                    </div>
                </div>
                <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:0.6rem;">Click a row to expand request &amp; response details</div>
                ${rows}`;
        }

        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML=''">Close</button>
            <button class="btn" style="background:#f1f5f9;color:#374151;border:1px solid #e5e7eb;"
                onclick="app.downloadSavedReport(${reportId})">⬇ Download HTML</button>`;
        Components.showModal(`Report — ${this._escapeHtml(report.label)}`, content, actions);
    }

    showEditSuiteModal(suiteId) {
        const suite = this.state.testSuites.find(s => s.id === suiteId);
        if (!suite) return;

        const content = `
            <div class="form-group">
                <label class="form-label">Suite Name *</label>
                <input type="text" id="edit-suite-name" class="form-control" value="${suite.name}">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="edit-suite-description" class="form-control" rows="3">${suite.description || ''}</textarea>
            </div>
        `;
        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
            <button class="btn btn-primary" onclick="app.updateTestSuite(${suiteId})">Save</button>
        `;
        Components.showModal('Edit Test Suite', content, actions);
    }

    async updateTestSuite(suiteId) {
        const name = document.getElementById('edit-suite-name').value;
        const description = document.getElementById('edit-suite-description').value;
        if (!name) { alert('Please enter a suite name'); return; }
        try {
            const updated = await apiClient.updateTestSuite(suiteId, { name, description });
            const idx = this.state.testSuites.findIndex(s => s.id === suiteId);
            if (idx !== -1) this.state.testSuites[idx] = updated;
            document.getElementById('modal-container').innerHTML = '';
            this.render();
            Components.showToast('Suite updated', 'success');
        } catch (error) {
            Components.showToast('Failed to update suite', 'error');
        }
    }

    editTestCase(testId) {
        const test = this.state.testCases.find(t => t.id === testId);
        if (!test) return;

        let parsedHeaders = '{}', parsedBody = '';
        try { parsedHeaders = test.headers ? JSON.stringify(JSON.parse(test.headers), null, 2) : '{}'; } catch(e) { parsedHeaders = test.headers || '{}'; }
        try { parsedBody = test.body ? JSON.stringify(JSON.parse(test.body), null, 2) : ''; } catch(e) { parsedBody = test.body || ''; }

        let existingAssertions = [];
        try { existingAssertions = test.assertions ? JSON.parse(test.assertions) : []; } catch(e) {}

        const assertionRows = existingAssertions.length > 0
            ? existingAssertions.map(a => this._assertionRow(a.field, a.operator, a.value)).join('')
            : this._assertionRow('', 'equals', '');

        const content = `
            <!-- Modal tabs -->
            <div style="display:flex;border-bottom:2px solid #e5e7eb;margin-bottom:1.25rem;">
                <button id="etab-request" onclick="app._switchEditTab('request')"
                    style="padding:0.5rem 1rem;border:none;background:none;font-weight:600;color:#3b82f6;border-bottom:2px solid #3b82f6;margin-bottom:-2px;cursor:pointer;">
                    Request
                </button>
                <button id="etab-assertions" onclick="app._switchEditTab('assertions')"
                    style="padding:0.5rem 1rem;border:none;background:none;color:#6b7280;cursor:pointer;">
                    Assertions
                </button>
            </div>

            <!-- Request tab -->
            <div id="epane-request">
                <div class="form-group">
                    <label class="form-label">Test Name *</label>
                    <input type="text" id="edit-test-name" class="form-control" value="${test.name}">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea id="edit-test-description" class="form-control" rows="2">${test.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Base URL</label>
                    <input type="text" id="edit-test-baseurl" class="form-control" value="${this.state.baseUrl}" placeholder="http://localhost:8080" style="font-family:monospace;">
                </div>
                <div class="form-group" style="display:flex;gap:0.75rem;">
                    <div style="flex:0 0 120px;">
                        <label class="form-label">Method</label>
                        <select id="edit-test-method" class="form-control">
                            ${['GET','POST','PUT','DELETE','PATCH'].map(m => `<option ${test.method===m?'selected':''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1">
                        <label class="form-label">Path</label>
                        <input type="text" id="edit-test-endpoint" class="form-control" value="${test.endpoint || ''}" placeholder="/api/resource" style="font-family:monospace;">
                    </div>
                </div>
                ${(() => {
                    const params = (test.endpoint || '').match(/(?<!\{)\{([^{}]+)\}(?!\})/g);
                    if (!params || params.length === 0) return '';
                    let stored = {};
                    try { stored = test.pathParams ? JSON.parse(test.pathParams) : {}; } catch(e) {}
                    return `
                        <div class="form-group">
                            <label class="form-label">Path Parameters</label>
                            ${params.map(p => {
                                const name = p.slice(1, -1);
                                return `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
                                    <label style="min-width:120px;font-size:0.85rem;color:#374151;">{${name}}</label>
                                    <input type="text" id="edit-path-param-${name}" class="form-control" value="${stored[name] || ''}" placeholder="value for ${name}">
                                </div>`;
                            }).join('')}
                        </div>`;
                })()}
                <div class="form-group">
                    <label class="form-label">Headers <span class="form-label-hint">(JSON)</span></label>
                    <textarea id="edit-test-headers" class="form-control" rows="3" style="font-family:monospace;font-size:0.85rem;">${parsedHeaders}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Body <span class="form-label-hint">(JSON)</span></label>
                    <textarea id="edit-test-body" class="form-control" rows="5" style="font-family:monospace;font-size:0.85rem;">${parsedBody}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Client Certificate <span class="form-label-hint">(optional — for mTLS)</span></label>
                    <select id="edit-test-cert" class="form-control">
                        <option value="">— None —</option>
                        ${(this.state.certificates || []).map(c =>
                            `<option value="${c.id}" ${test.certId == c.id ? 'selected' : ''}>${c.name} (${c.environment})</option>`
                        ).join('')}
                    </select>
                </div>
            </div>

            <!-- Assertions tab -->
            <div id="epane-assertions" style="display:none;">
                <div class="form-group">
                    <label class="form-label">Expected Status Code</label>
                    <input type="number" id="edit-test-status" class="form-control" value="${test.expectedStatus || 200}" style="max-width:150px;">
                </div>

                <div style="margin-bottom:0.75rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                        <label class="form-label" style="margin:0;">Response Assertions</label>
                        <button class="btn btn-sm" onclick="app._addAssertionRow()" style="font-size:0.8rem;">+ Add Assertion</button>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 160px 1fr 32px;gap:0.4rem;padding:0.4rem 0.5rem;background:#f9fafb;border-radius:4px;font-size:0.75rem;font-weight:600;color:#6b7280;">
                        <span>Field (dot notation)</span><span>Operator</span><span>Expected Value</span><span></span>
                    </div>
                    <div id="assertions-list" style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.4rem;">
                        ${assertionRows}
                    </div>
                    <p style="font-size:0.75rem;color:#9ca3af;margin-top:0.5rem;">
                        Body: <code>data.user.name</code>, <code>data.items[0].id</code>, <code>meta.total</code><br>
                        Headers: <code>header.content-type</code>, <code>header.x-request-id</code>
                    </p>
                </div>
            </div>
        `;
        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
            <button class="btn btn-primary" onclick="app.saveEditTestCase(${testId})">Save Changes</button>
        `;
        Components.showModal('Edit Test Case', content, actions);
    }

    _assertionRow(field = '', operator = 'equals', value = '') {
        const operators = [
            { group: 'Equality',   ops: ['equals','not_equals'] },
            { group: 'String',     ops: ['contains','not_contains','starts_with','ends_with','matches_regex'] },
            { group: 'Comparison', ops: ['greater_than','less_than','greater_than_or_equal','less_than_or_equal'] },
            { group: 'Type',       ops: ['is_number','is_integer','is_double','is_string','is_boolean','is_array','is_object','is_null','is_not_null'] },
            { group: 'Length',     ops: ['length_equals','length_greater_than','length_less_than'] },
            { group: 'Presence',   ops: ['exists','not_exists','is_empty','is_not_empty'] },
        ];
        // Operators that don't need a value input
        const noValueOps = new Set(['exists','not_exists','is_number','is_integer','is_double','is_string','is_boolean','is_array','is_object','is_null','is_not_null','is_empty','is_not_empty']);
        const hideValue = noValueOps.has(operator);
        const optionsHtml = operators.map(g =>
            `<optgroup label="${g.group}">${g.ops.map(op =>
                `<option value="${op}" ${operator===op?'selected':''}>${op.replace(/_/g,' ')}</option>`
            ).join('')}</optgroup>`
        ).join('');

        return `
            <div class="assertion-row" style="display:grid;grid-template-columns:1fr 190px 1fr 32px;gap:0.4rem;align-items:center;">
                <input type="text" class="form-control assertion-field" value="${field}" placeholder="data.user.name or header.content-type" style="font-family:monospace;font-size:0.85rem;">
                <select class="form-control assertion-operator" style="font-size:0.85rem;"
                    onchange="this.closest('.assertion-row').querySelector('.assertion-value').style.visibility=(['exists','not_exists','is_number','is_integer','is_double','is_string','is_boolean','is_array','is_object','is_null','is_not_null','is_empty','is_not_empty'].includes(this.value)?'hidden':'visible')">
                    ${optionsHtml}
                </select>
                <input type="text" class="form-control assertion-value" value="${value}"
                    placeholder="${operator === 'matches_regex' ? 'e.g. ^[A-Z]+$' : 'expected value'}"
                    style="font-size:0.85rem;visibility:${hideValue ? 'hidden' : 'visible'};">
                <button onclick="this.closest('.assertion-row').remove()" style="width:28px;height:28px;border:1px solid #e5e7eb;background:white;border-radius:4px;cursor:pointer;color:#dc2626;font-size:16px;">×</button>
            </div>
        `;
    }

    addRequestAssertion() {
        const list = document.getElementById('request-assertions-list');
        if (list) list.insertAdjacentHTML('beforeend', this._assertionRow());
    }

    _addAssertionRow() {
        const list = document.getElementById('assertions-list');
        if (list) list.insertAdjacentHTML('beforeend', this._assertionRow());
    }

    _switchEditTab(tab) {
        document.getElementById('epane-request').style.display = tab === 'request' ? '' : 'none';
        document.getElementById('epane-assertions').style.display = tab === 'assertions' ? '' : 'none';
        document.getElementById('etab-request').style.cssText += tab === 'request'
            ? ';color:#3b82f6;border-bottom:2px solid #3b82f6;margin-bottom:-2px;'
            : ';color:#6b7280;border-bottom:none;margin-bottom:0;';
        document.getElementById('etab-assertions').style.cssText += tab === 'assertions'
            ? ';color:#3b82f6;border-bottom:2px solid #3b82f6;margin-bottom:-2px;'
            : ';color:#6b7280;border-bottom:none;margin-bottom:0;';
    }

    async saveEditTestCase(testId) {
        const name = document.getElementById('edit-test-name').value.trim();
        if (!name) { this.showToast('Test name is required', 'error'); return; }

        const headersRaw = document.getElementById('edit-test-headers').value.trim();
        const bodyRaw = document.getElementById('edit-test-body').value.trim();

        let headersJson = null, bodyJson = null;
        try { headersJson = headersRaw ? JSON.stringify(JSON.parse(headersRaw)) : null; }
        catch(e) { this.showToast('Invalid JSON in Headers', 'error'); return; }
        try { bodyJson = bodyRaw ? JSON.stringify(JSON.parse(bodyRaw)) : null; }
        catch(e) { this.showToast('Invalid JSON in Body', 'error'); return; }

        const baseUrl = document.getElementById('edit-test-baseurl').value.trim();
        const path = document.getElementById('edit-test-endpoint').value.trim();

        // Persist base URL change globally
        if (baseUrl) this.setBaseUrl(baseUrl);

        // Collect assertions from rows
        const assertions = [];
        document.querySelectorAll('#assertions-list .assertion-row').forEach(row => {
            const field = row.querySelector('.assertion-field')?.value.trim();
            const operator = row.querySelector('.assertion-operator')?.value;
            const value = row.querySelector('.assertion-value')?.value.trim();
            if (field) assertions.push({ field, operator, value });
        });

        // Collect path params from edit modal inputs
        const editEndpoint = document.getElementById('edit-test-endpoint').value.trim();
        const editPathParamMatches = (editEndpoint || '').match(/(?<!\{)\{([^{}]+)\}(?!\})/g) || [];
        const editPathParamsObj = {};
        editPathParamMatches.forEach(p => {
            const paramName = p.slice(1, -1);
            const el = document.getElementById(`edit-path-param-${paramName}`);
            if (el && el.value.trim()) editPathParamsObj[paramName] = el.value.trim();
        });

        const certIdVal = document.getElementById('edit-test-cert')?.value;
        const updates = {
            name,
            description: document.getElementById('edit-test-description').value,
            method: document.getElementById('edit-test-method').value,
            endpoint: path,
            baseUrl,
            expectedStatus: parseInt(document.getElementById('edit-test-status').value) || 200,
            headers: headersJson,
            body: bodyJson,
            assertions: JSON.stringify(assertions),
            pathParams: Object.keys(editPathParamsObj).length > 0 ? JSON.stringify(editPathParamsObj) : null,
            certId: certIdVal ? parseInt(certIdVal) : null
        };

        try {
            const updated = await apiClient.updateTestCase(testId, updates);
            const idx = this.state.testCases.findIndex(t => t.id === testId);
            if (idx !== -1) this.state.testCases[idx] = { ...this.state.testCases[idx], ...updated };
            document.getElementById('modal-container').innerHTML = '';
            this.render();
            this.showToast('Test case updated', 'success');
        } catch (error) {
            this.showToast('Failed to update test case', 'error');
        }
    }

    // ==================== MOCK SERVER ====================

    async renderMockServerView() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        try {
            this.state.mockStatus = await apiClient.getMockServerStatus();
        } catch (e) {
            this.state.mockStatus = { running: false, endpoints: [] };
        }
        // Default selection: use already-running swagger, else the sidebar-selected swagger, else first available
        const defaultSwaggerId = this.state.mockStatus.swaggerFileId
            || this.state.selectedSwaggerId
            || (this.state.swaggerFiles[0] ? this.state.swaggerFiles[0].id : null);
        mainContent.innerHTML = Components.renderMockServer(this.state.swaggerFiles, this.state.mockStatus, defaultSwaggerId);
        if (this.state.mockStatus.running) {
            this.refreshMockLogs();
            this._startMockLogPolling();
        }
    }

    async toggleMockServer() {
        if (this.state.mockStatus && this.state.mockStatus.running) {
            await this.stopMockServer();
        } else {
            await this.startMockServer();
        }
    }

    async startMockServer() {
        const swaggerId = document.getElementById('mock-swagger-id')?.value;
        if (!swaggerId) { this.showToast('Please select a Swagger specification', 'error'); return; }

        const port = parseInt(document.getElementById('mock-port')?.value) || 8765;
        const delay = parseInt(document.getElementById('mock-delay')?.value) || 0;
        const strategy = document.getElementById('mock-strategy')?.value || 'smart';

        const btn = document.getElementById('mock-toggle-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Starting...'; }

        try {
            const status = await apiClient.startMockServer({ swaggerFileId: swaggerId, port, delay, strategy });
            this.state.mockStatus = status;
            this.showToast(`Mock server started on :${port} with ${status.endpointCount} endpoints`, 'success');
            await this.renderMockServerView();
            this._startMockLogPolling();
        } catch (e) {
            this.showToast('Failed to start mock server: ' + (e.message || e), 'error');
            if (btn) { btn.disabled = false; btn.textContent = '▶ Start Server'; }
        }
    }

    async stopMockServer() {
        try {
            await apiClient.stopMockServer();
            this._stopMockLogPolling();
            this.state.mockStatus = { running: false, endpoints: [] };
            this.showToast('Mock server stopped', 'info');
            await this.renderMockServerView();
        } catch (e) {
            this.showToast('Failed to stop mock server', 'error');
        }
    }

    async refreshMockLogs() {
        try {
            const logs = await apiClient.getMockServerLogs();
            this._renderMockLogs(logs);
        } catch (e) { /* ignore if not running */ }
    }

    async clearMockLogs() {
        try {
            await fetch('/api/mock/logs', { method: 'DELETE' });
            this._renderMockLogs([]);
        } catch (e) { /* ignore */ }
    }

    _renderMockLogs(logs) {
        const el = document.getElementById('mock-logs-content');
        if (!el) return;
        if (!logs || logs.length === 0) {
            el.innerHTML = '<span style="color:#475569;">No requests yet...</span>';
            return;
        }
        // Newest at top
        const lines = [...logs].reverse().map(log => {
            const isSystem = log.method === 'SYSTEM';
            const statusColor = isSystem ? '#94a3b8'
                : log.status >= 500 ? '#f87171'
                : log.status >= 400 ? '#fb923c'
                : '#4ade80';
            const methodColor = isSystem ? '#94a3b8'
                : log.method === 'GET' ? '#60a5fa'
                : log.method === 'POST' ? '#34d399'
                : log.method === 'PUT' ? '#fbbf24'
                : log.method === 'DELETE' ? '#f87171'
                : '#c4b5fd';

            if (isSystem) {
                return `<div style="color:#94a3b8;margin-bottom:2px;">[${log.time}] <em>${log.path}</em></div>`;
            }
            return `<div style="margin-bottom:2px;">
                <span style="color:#64748b;">[${log.time}]</span>
                <span style="color:${methodColor};font-weight:700;min-width:55px;display:inline-block;">${log.method}</span>
                <span style="color:#e2e8f0;">${log.path}</span>
                <span style="color:${statusColor};margin-left:0.5rem;font-weight:600;">${log.status}</span>
                ${log.duration ? `<span style="color:#64748b;margin-left:0.5rem;">${log.duration}</span>` : ''}
            </div>`;
        }).join('');
        el.innerHTML = lines;
    }

    _startMockLogPolling() {
        this._stopMockLogPolling();
        this._mockLogInterval = setInterval(() => {
            if (this.state.activeView === 'mockserver') this.refreshMockLogs();
        }, 2000);
    }

    _stopMockLogPolling() {
        if (this._mockLogInterval) {
            clearInterval(this._mockLogInterval);
            this._mockLogInterval = null;
        }
    }

    // ==================== REPORTS ====================

    saveReport(entries, label, closeModal = false) {
        const workspace = (this.state.workspaces || []).find(w => w.id === this.state.activeWorkspace);
        const passed = entries.filter(e => e.status === 'passed').length;
        const report = {
            id: Date.now(),
            label,
            workspaceName: workspace ? workspace.name : 'Workspace',
            timestamp: new Date().toISOString(),
            total: entries.length,
            passed,
            failed: entries.length - passed,
            entries
        };
        this._persistReports(report, 'Report saved to Reports tab');
        if (closeModal) document.getElementById('modal-container').innerHTML = '';
    }

    deleteSavedReport(reportId) {
        this.state.savedReports = this.state.savedReports.filter(r => r.id !== reportId);
        localStorage.setItem('apimanager_reports', JSON.stringify(this.state.savedReports));
        this.renderReportsView();
    }

    downloadSavedReport(reportId) {
        const report = this.state.savedReports.find(r => r.id === reportId);
        if (!report) return;
        let html;
        if (report.type === 'loadtest') {
            html = this._buildLoadTestReportHtml({
                stats:  report.loadTestStats  || {},
                config: report.loadTestConfig || {}
            });
        } else if (report.type === 'datadriven') {
            html = this._buildDataDrivenReportHtml(report);
        } else {
            html = this._buildReportHtml(report);
        }
        const filename = `report-${report.label.replace(/\s+/g, '-').toLowerCase()}-${reportId}.html`;
        reportGenerator.downloadReport(html, filename);
        this.showToast('Report downloaded', 'success');
    }

    _buildReportHtml(report) {
        const passRate = report.total > 0 ? ((report.passed / report.total) * 100).toFixed(1) : '0.0';
        const passColor = parseFloat(passRate) >= 80 ? '#10b981' : parseFloat(passRate) >= 50 ? '#f59e0b' : '#ef4444';
        const ts = new Date(report.timestamp).toLocaleString();

        const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const codeBlock = text =>
            `<pre style="background:#1e293b;color:#a3e635;padding:0.65rem 0.85rem;border-radius:4px;
                font-size:0.75rem;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:4px 0 8px;">${esc(text)}</pre>`;
        const sectionLabel = t =>
            `<div style="font-size:0.68rem;font-weight:700;color:#9ca3af;text-transform:uppercase;
                letter-spacing:0.05em;margin:8px 0 3px;">${t}</div>`;

        const mColors = {GET:'#dbeafe/#1d4ed8',POST:'#dcfce7/#15803d',PUT:'#fef9c3/#a16207',
                         DELETE:'#fee2e2/#b91c1c',PATCH:'#ede9fe/#6d28d9'};

        const testRows = report.entries.map(e => {
            const statusBg    = e.status === 'passed' ? '#d1fae5' : '#fee2e2';
            const statusColor = e.status === 'passed' ? '#065f46' : '#991b1b';

            const [mbg, mfg] = (mColors[e.method] || '#f1f5f9/#374151').split('/');
            const methodBadge = `<span style="display:inline-block;padding:1px 7px;border-radius:3px;font-size:0.72rem;
                font-weight:700;font-family:monospace;background:${mbg};color:${mfg};">${esc(e.method)}</span>`;

            const displayUrl = e.displayUrl || e.endpoint || '';

            // Path params table
            const ppEntries = Object.entries(e.pathParams || {});
            const ppHtml = ppEntries.length ? `
                ${sectionLabel('Path Parameters')}
                <table style="font-size:0.8rem;border-collapse:collapse;">
                    ${ppEntries.map(([k,v]) =>
                        `<tr><td style="padding:2px 8px;color:#6b7280;font-family:monospace;">{${esc(k)}}</td>
                             <td style="padding:2px 8px;font-family:monospace;">${esc(String(v))}</td></tr>`
                    ).join('')}
                </table>` : '';

            // Headers
            const headersObj = typeof e.headers === 'object' ? e.headers : {};
            const headersHtml = Object.keys(headersObj).length
                ? sectionLabel('Headers') + codeBlock(JSON.stringify(headersObj, null, 2)) : '';

            // Request body
            let prettyBody = e.body || '';
            try { prettyBody = prettyBody ? JSON.stringify(JSON.parse(prettyBody), null, 2) : ''; } catch (_) {}
            const bodyHtml = prettyBody ? sectionLabel('Request Body') + codeBlock(prettyBody) : '';

            // Response body
            let prettyResp = e.response || '';
            try { prettyResp = prettyResp ? JSON.stringify(JSON.parse(prettyResp), null, 2) : ''; } catch (_) {}
            const respHtml = e.error
                ? `${sectionLabel('Error')}<div style="color:#dc2626;font-size:0.85rem;">${esc(e.error)}</div>`
                : (prettyResp ? sectionLabel('Response Body') + codeBlock(prettyResp) : '');

            // Assertions
            const assertionsHtml = (e.assertions || []).length === 0
                ? ''
                : sectionLabel('Assertions') + (e.assertions.map(a => `
                    <div style="padding:4px 8px;border-left:3px solid ${a.passed ? '#10b981' : '#ef4444'};
                         margin-bottom:3px;background:#f9fafb;font-size:0.8rem;">
                        <span style="color:${a.passed ? '#059669' : '#dc2626'};font-weight:600;">${a.passed ? '✓' : '✗'}</span>
                        ${esc(a.name || '')} <span style="color:#6b7280;">${esc(a.detail || '')}</span>
                    </div>`).join(''));

            return `
            <details style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:1rem;overflow:hidden;border-left:4px solid ${e.status === 'passed' ? '#10b981' : '#ef4444'};">
                <summary style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;
                    background:#f9fafb;border-bottom:1px solid #e5e7eb;cursor:pointer;list-style:none;user-select:none;"
                    onclick="this.querySelector('.chev').style.transform=this.parentElement.open?'rotate(0deg)':'rotate(90deg)'">
                    <span style="display:flex;align-items:center;gap:0.5rem;">
                        <span class="chev" style="display:inline-block;transition:transform .2s;font-size:0.7rem;color:#9ca3af;">&#9654;</span>
                        <span style="font-weight:600;">${esc(e.name)}</span>
                    </span>
                    <span style="display:flex;align-items:center;gap:1rem;">
                        <span style="font-size:0.85rem;color:#6b7280;">${e.statusCode ?? '-'} &nbsp;|&nbsp; ${e.responseTime ?? '-'}</span>
                        <span style="padding:3px 10px;border-radius:9999px;font-size:0.75rem;font-weight:600;
                            background:${statusBg};color:${statusColor};">${e.status.toUpperCase()}</span>
                    </span>
                </summary>
                <div style="padding:0.75rem 1rem;">
                    ${sectionLabel('Request')}
                    <div style="display:flex;align-items:center;gap:0.4rem;font-family:monospace;font-size:0.82rem;
                         background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:5px 8px;
                         margin-bottom:4px;word-break:break-all;">
                        ${methodBadge} <span>${esc(displayUrl)}</span>
                    </div>
                    ${ppHtml}${headersHtml}${bodyHtml}${respHtml}${assertionsHtml}
                </div>
            </details>`;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report — ${report.label}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f5f5f5; padding:2rem; color:#111827; }
        .container { max-width:960px; margin:0 auto; background:#fff; border-radius:10px; box-shadow:0 2px 12px rgba(0,0,0,.1); overflow:hidden; }
        .header { background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; padding:2rem; }
        .header h1 { font-size:1.75rem; margin-bottom:0.4rem; }
        .header p { opacity:.85; font-size:0.875rem; }
        .summary { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; padding:1.5rem; border-bottom:1px solid #e5e7eb; }
        .card { text-align:center; padding:1rem; border-radius:8px; }
        .card .num { font-size:2rem; font-weight:700; }
        .card .lbl { font-size:0.75rem; margin-top:4px; color:#6b7280; }
        .donut-wrap { text-align:center; padding:1.5rem; border-bottom:1px solid #e5e7eb; }
        .donut-wrap svg { width:120px; height:120px; }
        .tests { padding:1.5rem; }
        .tests h2 { margin-bottom:1rem; font-size:1rem; color:#374151; }
        .footer { padding:1rem 1.5rem; text-align:center; font-size:0.75rem; color:#9ca3af; border-top:1px solid #e5e7eb; }
        details summary::-webkit-details-marker { display:none; }
        details summary::marker { display:none; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>Test Report — ${report.label}</h1>
        <p>Workspace: ${report.workspaceName} &nbsp;|&nbsp; Generated: ${ts}</p>
    </div>
    <div class="summary">
        <div class="card" style="background:#eff6ff;"><div class="num" style="color:#3b82f6;">${report.total}</div><div class="lbl">Total</div></div>
        <div class="card" style="background:#d1fae5;"><div class="num" style="color:#10b981;">${report.passed}</div><div class="lbl">Passed</div></div>
        <div class="card" style="background:#fee2e2;"><div class="num" style="color:#ef4444;">${report.failed}</div><div class="lbl">Failed</div></div>
        <div class="card" style="background:#f1f5f9;"><div class="num" style="color:${passColor};">${passRate}%</div><div class="lbl">Pass Rate</div></div>
    </div>
    <div class="donut-wrap">
        <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" stroke-width="12"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="${passColor}" stroke-width="12"
                stroke-dasharray="${(parseFloat(passRate)/100)*263.9} 263.9"
                transform="rotate(-90 50 50)" stroke-linecap="round"/>
            <text x="50" y="50" text-anchor="middle" dominant-baseline="middle"
                fill="${passColor}" font-size="16" font-weight="700">${passRate}%</text>
        </svg>
        <div style="color:#6b7280;font-size:0.85rem;margin-top:0.5rem;">Pass Rate</div>
    </div>
    <div class="tests">
        <h2>Test Results</h2>
        ${testRows}
    </div>
    <div class="footer">Generated by API Automation Tool 3.0 &nbsp;•&nbsp; ${ts}</div>
</div>
</body>
</html>`;
    }

    _buildDataDrivenReportHtml(report) {
        const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const passRate = report.total > 0 ? ((report.passed / report.total) * 100).toFixed(1) : '0.0';
        const passColor = parseFloat(passRate) >= 80 ? '#10b981' : parseFloat(passRate) >= 50 ? '#f59e0b' : '#ef4444';
        const ts = new Date(report.timestamp).toLocaleString();
        const varKeys = [...new Set((report.rows || []).flatMap(r => Object.keys(r.variables || {})))];

        const headerCells = ['Row', ...varKeys, 'Status', 'Expected', 'Time', 'Assertions', 'Result']
            .map(h => `<th style="padding:8px 12px;text-align:left;background:#f1f5f9;border-bottom:2px solid #e2e8f0;">${esc(h)}</th>`)
            .join('');

        const dataRows = (report.rows || []).map(r => {
            const bg = r.passed ? '#f0fdf4' : r.error ? '#fff7ed' : '#fef2f2';
            const assertText = (r.assertions || [])
                .map(a => `${a.passed ? '✓' : '✗'} ${a.name || ''}: ${a.detail || ''}`)
                .join('\n');
            const result = r.error ? `⚠ Error: ${r.error}` : r.passed ? '✅ Pass' : '❌ Fail';
            return `<tr style="background:${bg};border-bottom:1px solid #e5e7eb;">
                <td style="padding:7px 12px;font-weight:600;">#${r.row}</td>
                ${varKeys.map(k => `<td style="padding:7px 12px;font-family:monospace;">${esc((r.variables||{})[k]||'')}</td>`).join('')}
                <td style="padding:7px 12px;text-align:center;font-weight:600;">${r.actualStatus}</td>
                <td style="padding:7px 12px;text-align:center;">${r.expectedStatus}</td>
                <td style="padding:7px 12px;text-align:center;">${esc(r.responseTime||'')}</td>
                <td style="padding:7px 12px;font-size:0.8rem;white-space:pre-line;">${esc(assertText)||'—'}</td>
                <td style="padding:7px 12px;text-align:center;">${esc(result)}</td>
            </tr>`;
        }).join('');

        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Data-Driven Report — ${esc(report.label)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f8fafc;color:#1e293b;}
  .header{background:linear-gradient(135deg,#166534,#15803d);color:white;padding:2rem;}
  .header h1{margin:0 0 0.5rem;font-size:1.6rem;}
  .meta{opacity:0.85;font-size:0.9rem;}
  .container{max-width:1200px;margin:2rem auto;padding:0 1.5rem;}
  .stats{display:flex;gap:1rem;margin-bottom:2rem;flex-wrap:wrap;}
  .stat{flex:1;min-width:120px;background:white;border-radius:8px;padding:1.25rem;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.07);}
  .stat-val{font-size:2rem;font-weight:700;}
  .stat-lbl{font-size:0.75rem;color:#6b7280;margin-top:2px;}
  table{width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);}
  .footer{text-align:center;color:#94a3b8;font-size:0.8rem;padding:2rem 0;}
</style></head><body>
<div class="header">
  <h1>⚡ Data-Driven Test Report</h1>
  <div class="meta">${esc(report.testCaseName || report.label)} &nbsp;•&nbsp; ${esc(report.fileName || '')} &nbsp;•&nbsp; ${ts}</div>
</div>
<div class="container">
  <div class="stats">
    <div class="stat"><div class="stat-val" style="color:#059669;">${report.passed}</div><div class="stat-lbl">Passed</div></div>
    <div class="stat"><div class="stat-val" style="color:#dc2626;">${report.failed}</div><div class="stat-lbl">Failed</div></div>
    <div class="stat"><div class="stat-val">${report.total}</div><div class="stat-lbl">Total Rows</div></div>
    <div class="stat"><div class="stat-val" style="color:${passColor};">${passRate}%</div><div class="stat-lbl">Pass Rate</div></div>
  </div>
  <table><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>
</div>
<div class="footer">Generated by API Automation Tool 3.0 &nbsp;•&nbsp; ${ts}</div>
</body></html>`;
    }

    // ── Report persistence with 50-report cap ─────────────────────────────────
    static get MAX_REPORTS() { return 50; }

    _persistReports(report, toastMsg, toastType = 'success') {
        this.state.savedReports.unshift(report);

        const limit = APIManagerApp.MAX_REPORTS;
        const pruned = this.state.savedReports.length - limit;
        if (pruned > 0) {
            this.state.savedReports = this.state.savedReports.slice(0, limit);
        }

        try {
            localStorage.setItem('apimanager_reports', JSON.stringify(this.state.savedReports));
        } catch (e) {
            // QuotaExceededError — storage full even after pruning
            Components.showToast('⚠ Storage full — oldest reports removed to free space', 'error');
            // Drop oldest half and retry
            this.state.savedReports = this.state.savedReports.slice(0, Math.floor(limit / 2));
            localStorage.setItem('apimanager_reports', JSON.stringify(this.state.savedReports));
        }

        const msg = pruned > 0
            ? `${toastMsg} (${pruned} old report${pruned > 1 ? 's' : ''} removed — limit is ${limit})`
            : toastMsg;
        Components.showToast(msg, toastType);

        // Refresh reports view if it's currently visible
        if (document.getElementById('main-content')?.querySelector('[data-view="reports"]') ||
            this.state.activeView === 'reports') {
            this.renderReportsView();
        }
    }

    renderReportsView() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        const reports = this.state.savedReports || [];

        if (reports.length === 0) {
            mainContent.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:400px;gap:1rem;color:#9ca3af;">
                    <div style="font-size:3rem;">📊</div>
                    <div style="font-size:1.1rem;font-weight:600;color:#374151;">No saved reports yet</div>
                    <div style="font-size:0.875rem;">Run test cases and click <strong>Save to Reports</strong> to save a report here.</div>
                </div>`;
            return;
        }

        const cards = reports.map(r => {
            const passColor = r.total > 0 && r.passed / r.total >= 0.8 ? '#059669' : r.total > 0 && r.passed / r.total >= 0.5 ? '#d97706' : '#dc2626';
            const passRate = r.total > 0 ? Math.round(r.passed / r.total * 100) : 0;
            const icon    = r.type === 'loadtest' ? '⚡' : r.type === 'datadriven' ? '📋' : '📊';
            const iconBg  = r.type === 'loadtest' ? '#fef9c3' : r.type === 'datadriven' ? '#f0fdf4' : '#f1f5f9';
            const typeBadge = r.type === 'loadtest'   ? '<span style="font-size:0.7rem;padding:1px 7px;background:#fef9c3;color:#92400e;border-radius:999px;font-weight:600;">Load Test</span>'
                            : r.type === 'datadriven' ? '<span style="font-size:0.7rem;padding:1px 7px;background:#f0fdf4;color:#166534;border-radius:999px;font-weight:600;">Data-Driven</span>'
                            : '';
            return `
            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;background:#fff;display:flex;align-items:center;gap:1.25rem;">
                <div style="width:56px;height:56px;border-radius:50%;background:${iconBg};display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">${icon}</div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:2px;">
                        <span style="font-weight:600;font-size:1rem;">${r.label}</span>
                        ${typeBadge}
                    </div>
                    <div style="font-size:0.8rem;color:#6b7280;">${r.workspaceName} &nbsp;•&nbsp; ${new Date(r.timestamp).toLocaleString()}</div>
                    <div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.85rem;">
                        <span style="color:#059669;font-weight:600;">✓ ${r.passed} passed</span>
                        <span style="color:#dc2626;font-weight:600;">✗ ${r.failed} failed</span>
                        <span style="color:#6b7280;">${r.total} total</span>
                        <span style="color:${passColor};font-weight:700;">${passRate}% pass rate</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-shrink:0;">
                    <button class="btn btn-primary" style="font-size:0.8rem;" onclick="app.viewSavedReport(${r.id})">View</button>
                    <button class="btn" style="background:#f1f5f9;color:#374151;border:1px solid #e5e7eb;font-size:0.8rem;" onclick="app.downloadSavedReport(${r.id})">⬇ HTML</button>
                    <button class="btn btn-text" style="font-size:0.8rem;color:#dc2626;" onclick="app.deleteSavedReport(${r.id})">Delete</button>
                </div>
            </div>`;
        }).join('');

        const count     = reports.length;
        const limit     = APIManagerApp.MAX_REPORTS;
        const fillPct   = Math.round(count / limit * 100);
        const barColor  = fillPct >= 90 ? '#dc2626' : fillPct >= 70 ? '#f59e0b' : '#10b981';

        mainContent.innerHTML = `
            <div style="padding:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                    <h2 style="font-size:1.25rem;font-weight:700;">Saved Reports</h2>
                    <button class="btn btn-text" style="color:#dc2626;" onclick="if(confirm('Delete all reports?')){app.state.savedReports=[];localStorage.removeItem('apimanager_reports');app.renderReportsView();}">Clear All</button>
                </div>
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;padding:0.6rem 0.85rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
                    <span style="font-size:0.8rem;color:#6b7280;white-space:nowrap;">${count} / ${limit} reports</span>
                    <div style="flex:1;height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden;">
                        <div style="width:${fillPct}%;height:100%;background:${barColor};border-radius:999px;transition:width 0.3s;"></div>
                    </div>
                    <span style="font-size:0.8rem;font-weight:600;color:${barColor};white-space:nowrap;">${fillPct}%</span>
                    ${fillPct >= 80 ? `<span style="font-size:0.75rem;color:${barColor};">⚠ Oldest reports will be removed when limit is reached</span>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:0.75rem;">${cards}</div>
            </div>`;
    }

    renderCertificatesView() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        const certs = this.state.certificates || [];

        const certTypeColor = ct => ct === 'PKCS12' ? '#3b82f6' : ct === 'PEM' ? '#10b981' : '#6b7280';
        const envColor = e => e === 'production' ? '#dc2626' : e === 'staging' ? '#f59e0b' : '#10b981';
        const expiryBadge = exp => {
            if (!exp) return '';
            // Jackson serializes LocalDate as [year, month, day] array
            let dateStr = Array.isArray(exp)
                ? `${exp[0]}-${String(exp[1]).padStart(2,'0')}-${String(exp[2]).padStart(2,'0')}`
                : String(exp);
            const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
            const color = days < 0 ? '#dc2626' : days < 30 ? '#f59e0b' : '#10b981';
            const label = days < 0 ? 'Expired' : days < 30 ? `Expires in ${days}d` : dateStr;
            return `<span style="font-size:0.7rem;padding:2px 7px;border-radius:4px;background:${color}20;color:${color};font-weight:600;">${label}</span>`;
        };

        const rows = certs.length === 0
            ? `<div style="text-align:center;padding:3rem;color:#9ca3af;">No certificates yet. Upload your first certificate below.</div>`
            : certs.map(c => `
                <div style="display:flex;align-items:center;gap:1rem;padding:0.85rem 1rem;border-bottom:1px solid #f1f5f9;">
                    <div style="font-size:1.5rem;">🔐</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:0.9rem;">${this._escapeHtml(c.name)}</div>
                        <div style="display:flex;gap:0.5rem;align-items:center;margin-top:3px;flex-wrap:wrap;">
                            <span style="font-size:0.7rem;padding:2px 7px;border-radius:4px;background:${certTypeColor(c.certType)}20;color:${certTypeColor(c.certType)};font-weight:600;">${c.certType || 'PKCS12'}</span>
                            <span style="font-size:0.7rem;padding:2px 7px;border-radius:4px;background:${envColor(c.environment)}20;color:${envColor(c.environment)};font-weight:600;">${c.environment}</span>
${expiryBadge(c.expiresAt)}
                        </div>
                    </div>
                    <button onclick="app.deleteCertificate(${c.id})"
                        style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:0.8rem;padding:4px 8px;border-radius:4px;"
                        title="Delete">✕ Delete</button>
                </div>`).join('');

        mainContent.innerHTML = `
            <div style="padding:1.5rem;max-width:860px;margin:0 auto;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
                    <div>
                        <h2 style="font-size:1.25rem;font-weight:700;margin:0;">Client Certificates</h2>
                        <p style="color:#6b7280;font-size:0.85rem;margin:0.25rem 0 0;">
                            Workspace-scoped mTLS certificates. Reference them in test cases and load tests.
                        </p>
                    </div>
                </div>

                <!-- Certificate list -->
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:2rem;overflow:hidden;">
                    <div style="padding:0.75rem 1rem;border-bottom:1px solid #e5e7eb;background:#f9fafb;">
                        <span style="font-weight:600;font-size:0.875rem;">Stored Certificates (${certs.length})</span>
                    </div>
                    ${rows}
                </div>

                <!-- Upload form -->
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1.5rem;">
                    <h3 style="font-size:1rem;font-weight:700;margin:0 0 1.25rem;">Upload Certificate</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Name *</label>
                            <input id="cert-name" class="form-control" placeholder="e.g., prod-client-cert">
                        </div>
                        <div>
                            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Environment</label>
                            <select id="cert-env" class="form-control">
                                <option value="development">Development</option>
                                <option value="staging">Staging</option>
                                <option value="production">Production</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Certificate Type</label>
                            <select id="cert-type" class="form-control">
                                <option value="PKCS12">PKCS12 (.p12 / .pfx)</option>
                                <option value="JKS">JKS (.jks)</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Passphrase</label>
                            <input id="cert-passphrase" type="password" class="form-control" placeholder="Leave blank if none">
                        </div>
                        <div>
                            <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Expiry Date (optional)</label>
                            <input id="cert-expires" type="date" class="form-control">
                        </div>
                    </div>
                    <div style="margin-top:1rem;">
                        <label style="font-size:0.8rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Certificate File *</label>
                        <input id="cert-file" type="file" accept=".p12,.pfx,.jks"
                            style="display:block;width:100%;padding:0.5rem;border:1px dashed #d1d5db;border-radius:6px;background:#f9fafb;font-size:0.85rem;">
                        <div style="font-size:0.75rem;color:#9ca3af;margin-top:4px;">Supported: PKCS12 (.p12, .pfx), JKS (.jks)</div>
                    </div>
                    <div style="margin-top:1.25rem;display:flex;justify-content:flex-end;">
                        <button class="btn btn-primary" onclick="app.uploadCertificate()">Upload Certificate</button>
                    </div>
                </div>
            </div>`;
    }

    async uploadCertificate() {
        const name = document.getElementById('cert-name').value.trim();
        const file = document.getElementById('cert-file').files[0];
        if (!name) { Components.showToast('Certificate name is required', 'error'); return; }
        if (!file)  { Components.showToast('Please select a certificate file', 'error'); return; }

        const reader = new FileReader();
        reader.onload = async (e) => {
            // Convert ArrayBuffer to base64
            const bytes = new Uint8Array(e.target.result);
            let binary = '';
            bytes.forEach(b => binary += String.fromCharCode(b));
            const base64 = btoa(binary);

            try {
                const cert = await apiClient.saveCertificate({
                    workspaceId: this.state.activeWorkspace,
                    name,
                    environment: document.getElementById('cert-env').value,
                    certType:    document.getElementById('cert-type').value,
                    passphrase:  document.getElementById('cert-passphrase').value || null,
                    expiresAt:   document.getElementById('cert-expires').value || null,
                    content:     base64
                });
                this.state.certificates.push(cert);
                Components.showToast('Certificate uploaded', 'success');
                this.renderCertificatesView();
            } catch(err) {
                Components.showToast('Upload failed: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    async deleteCertificate(certId) {
        if (!confirm('Delete this certificate? Test cases referencing it will lose their cert binding.')) return;
        const ok = await apiClient.deleteCertificate(certId);
        if (!ok) { Components.showToast('Delete failed', 'error'); return; }
        this.state.certificates = this.state.certificates.filter(c => c.id !== certId);
        Components.showToast('Certificate deleted', 'success');
        this.renderCertificatesView();
    }

    // Substitute {{VAR}} patterns using active environment variables
    substituteVariables(text) {
        if (!text) return text;
        const vars = this.state.environmentVariables || [];
        return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const found = vars.find(v => v.key === key.trim() && v.enabled !== false);
            return found ? found.value : match;
        });
    }

    // ==================== DATA-DRIVEN TESTING ====================

    showDataDrivenModal(testId, testName) {
        document.getElementById('data-driven-modal')?.remove();
        document.body.insertAdjacentHTML('beforeend', Components.renderDataDrivenModal(testId, testName));
        this._ddFile = null;
        this._ddTestId = testId;
    }

    _ddHandleFile(file) {
        if (!file) return;
        this._ddFile = file;
        const dropZone = document.getElementById('dd-drop-zone');
        if (dropZone) {
            dropZone.style.borderColor = '#3b82f6';
            dropZone.style.background = '#eff6ff';
            dropZone.querySelector('div:nth-child(2)').textContent = '\uD83D\uDCC4 ' + file.name;
        }
        // Enable run button
        const runBtn = document.getElementById('dd-run-btn');
        if (runBtn) { runBtn.disabled = false; runBtn.style.opacity = '1'; }
        // Show preview
        this._ddPreviewFile(file);
    }

    _ddPreviewFile(file) {
        const name = file.name.toLowerCase();
        const previewEl = document.getElementById('dd-preview');
        const tableEl  = document.getElementById('dd-preview-table');
        const countEl  = document.getElementById('dd-preview-count');
        if (!previewEl || !tableEl) return;

        if (name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = e => {
                const lines = e.target.result.split('\n').filter(l => l.trim());
                const headers = lines[0].split(',').map(h => h.trim());
                const rows = lines.slice(1, 6).map(l => l.split(',').map(c => c.trim())); // max 5 preview rows
                countEl.textContent = '(' + (lines.length - 1) + ' row' + (lines.length !== 2 ? 's' : '') + ')';
                tableEl.innerHTML = this._ddBuildPreviewTable(headers, rows);
                previewEl.style.display = '';
            };
            reader.readAsText(file);
        } else {
            // For Excel show a simple message — preview requires server-side parse
            countEl.textContent = '(Excel file \u2014 preview after run)';
            tableEl.innerHTML = '<div style="padding:1rem;color:#6b7280;font-size:0.85rem;">Excel preview not available in browser. The file will be parsed server-side when you run.</div>';
            previewEl.style.display = '';
        }
    }

    _ddBuildPreviewTable(headers, rows) {
        const colorForHeader = h => {
            if (h.startsWith('var.'))           return '#eff6ff';
            if (h === 'expected_status')        return '#fefce8';
            if (h.startsWith('assert.'))        return '#f0fdf4';
            return 'white';
        };
        return '<table style="width:100%;border-collapse:collapse;white-space:nowrap;">' +
            '<thead><tr style="background:#f9fafb;position:sticky;top:0;">' +
            headers.map(h => '<th style="padding:6px 10px;border:1px solid #e5e7eb;font-size:0.75rem;background:' + colorForHeader(h) + ';">' + h + '</th>').join('') +
            '</tr></thead>' +
            '<tbody>' +
            rows.map(row => '<tr>' + headers.map((h, i) => '<td style="padding:5px 10px;border:1px solid #e5e7eb;font-size:0.75rem;">' + (row[i] || '') + '</td>').join('') + '</tr>').join('') +
            '</tbody></table>';
    }

    async runDataDrivenTest(testId) {
        if (!this._ddFile) return;
        const runBtn    = document.getElementById('dd-run-btn');
        const statusEl  = document.getElementById('dd-status-text');
        const resultsEl = document.getElementById('dd-results');

        runBtn.disabled = true;
        runBtn.textContent = '\u23F3 Running...';
        if (statusEl) statusEl.textContent = 'Sending requests...';

        try {
            const results = await apiClient.runDataDrivenTest(testId, this._ddFile);
            if (statusEl) statusEl.textContent = '';
            runBtn.textContent = '\u25B6 Run All Rows';
            runBtn.disabled = false;
            this._ddShowResults(results);
        } catch (e) {
            if (statusEl) statusEl.textContent = '\u274C ' + e.message;
            runBtn.textContent = '\u25B6 Run All Rows';
            runBtn.disabled = false;
        }
    }

    _ddShowResults(results) {
        const resultsEl  = document.getElementById('dd-results');
        const tableEl    = document.getElementById('dd-results-table');
        const summaryEl  = document.getElementById('dd-summary-badge');
        if (!resultsEl || !tableEl) return;

        const total   = results.length;
        const passed  = results.filter(r => r.passed).length;
        const failed  = total - passed;
        const allPass = failed === 0;

        summaryEl.innerHTML =
            '<span style="padding:0.25rem 0.75rem;border-radius:999px;font-size:0.8rem;font-weight:600;' +
            'background:' + (allPass ? '#d1fae5' : '#fee2e2') + ';color:' + (allPass ? '#065f46' : '#991b1b') + ';">' +
            passed + '/' + total + ' passed</span>';

        // Collect all variable keys
        const varKeys = [...new Set(results.flatMap(r => Object.keys(r.variables || {})))];

        tableEl.innerHTML =
            '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">' +
            '<thead><tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">' +
            '<th style="padding:8px 10px;text-align:left;white-space:nowrap;">Row</th>' +
            varKeys.map(k => '<th style="padding:8px 10px;text-align:left;white-space:nowrap;">' + k + '</th>').join('') +
            '<th style="padding:8px 10px;text-align:center;white-space:nowrap;">Status</th>' +
            '<th style="padding:8px 10px;text-align:center;white-space:nowrap;">Expected</th>' +
            '<th style="padding:8px 10px;text-align:center;white-space:nowrap;">Time</th>' +
            '<th style="padding:8px 10px;text-align:left;white-space:nowrap;">Assertions</th>' +
            '<th style="padding:8px 10px;text-align:center;white-space:nowrap;">Result</th>' +
            '</tr></thead>' +
            '<tbody>' +
            results.map(r => {
                const rowBg = r.passed ? '#f0fdf4' : (r.error ? '#fff7ed' : '#fef2f2');
                const assertList = (r.assertions || []).map(a =>
                    '<div style="color:' + (a.passed ? '#059669' : '#dc2626') + ';white-space:nowrap;">' +
                    (a.passed ? '\u2713' : '\u2717') + ' ' + (a.name || '') + ': ' + (a.detail || '') +
                    '</div>'
                ).join('');
                return '<tr style="background:' + rowBg + ';border-bottom:1px solid #e5e7eb;">' +
                    '<td style="padding:8px 10px;font-weight:600;">#' + r.row + '</td>' +
                    varKeys.map(k => '<td style="padding:8px 10px;font-family:monospace;">' + ((r.variables || {})[k] || '') + '</td>').join('') +
                    '<td style="padding:8px 10px;text-align:center;font-weight:600;">' + r.actualStatus + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;color:#6b7280;">' + r.expectedStatus + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;color:#6b7280;">' + (r.responseTime || '') + '</td>' +
                    '<td style="padding:8px 10px;">' + (assertList || '<span style="color:#9ca3af;">\u2014</span>') + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' +
                    (r.error
                        ? '<span title="' + r.error + '" style="color:#ea580c;">\u26A0 Error</span>'
                        : r.passed
                            ? '<span style="color:#059669;font-weight:600;">\u2705 Pass</span>'
                            : '<span style="color:#dc2626;font-weight:600;">\u274C Fail</span>') +
                    '</td></tr>';
            }).join('') +
            '</tbody></table>';

        resultsEl.style.display = '';
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Auto-save to Reports
        this._ddSaveReport(results);
    }

    _ddSaveReport(results) {
        const total  = results.length;
        const passed = results.filter(r => r.passed).length;
        const workspace = (this.state.workspaces || []).find(w => w.id === this.state.activeWorkspace);
        const testCase  = (this.state.testCases  || []).find(t => t.id === this._ddTestId);
        const label = `Data-Driven — ${testCase ? testCase.name : 'Test #' + this._ddTestId}` +
                      (this._ddFile ? ` (${this._ddFile.name})` : '');

        const report = {
            id:            Date.now(),
            label,
            workspaceName: workspace ? workspace.name : 'Workspace',
            timestamp:     new Date().toISOString(),
            type:          'datadriven',
            total,
            passed,
            failed:        total - passed,
            testCaseName:  testCase ? testCase.name : '',
            testCaseId:    this._ddTestId,
            fileName:      this._ddFile ? this._ddFile.name : '',
            rows:          results
        };

        this._persistReports(report, `Data-driven report saved (${passed}/${total} passed)`, passed === total ? 'success' : 'error');
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new APIManagerApp();
});

