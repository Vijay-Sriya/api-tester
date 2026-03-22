/**
 * UI Components
 * Reusable component functions for rendering UI elements
 */

const Components = {
    /**
     * Render Quick Test Panel
     */
    renderQuickTestPanel() {
        return `
            <div class="quick-test-panel">
                <div class="quick-test-header">
                    <div class="quick-test-title">
                        <svg fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"></path>
                        </svg>
                        <h2>Quick Test</h2>
                    </div>
                    <p class="quick-test-subtitle">Fire ad-hoc requests without saving anything</p>
                </div>

                <div class="quick-test-content">
                    <div class="form-group">
                        <label class="form-label">Request</label>
                        <div class="form-control-group">
                            <select id="qt-method" class="form-select" style="width: 150px;">
                                <option>GET</option>
                                <option>POST</option>
                                <option>PUT</option>
                                <option>DELETE</option>
                                <option>PATCH</option>
                                <option>HEAD</option>
                                <option>OPTIONS</option>
                            </select>
                            <input type="text" id="qt-url" class="form-control"
                                   placeholder="http://localhost:8080/api/..."
                                   value="http://localhost:8080/api/fraud/validate">
                            <button class="btn btn-warning" onclick="app.sendQuickTest()">
                                <span>Send</span>
                            </button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">
                            Headers
                            <span class="form-label-hint">(JSON format, optional)</span>
                        </label>
                        <textarea id="qt-headers" class="code-editor" rows="5">{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{TOKEN}}"
}</textarea>
                    </div>

                    <div class="form-group" id="qt-body-group">
                        <label class="form-label">
                            Request Body
                            <span class="form-label-hint">(JSON format, optional)</span>
                        </label>
                        <textarea id="qt-body" class="code-editor" rows="8">{
  "transactionId": "TXN123456",
  "amount": 1500.00,
  "currency": "USD"
}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Client Certificate <span class="form-label-hint">(optional — for mTLS)</span></label>
                        <select id="qt-cert" class="form-control">
                            <option value="">— None —</option>
                        </select>
                    </div>

                    <div id="qt-response-container"></div>
                </div>
            </div>
        `;
    },

    /**
     * Render Quick Test Response
     */
    renderQuickTestResponse(response) {
        return `
            <div class="response-card">
                <div class="response-header">
                    <div class="response-meta">
                        <span class="${response.status >= 200 && response.status < 300 ? 'status-success' : 'status-error'}">
                            Status: ${response.status}
                        </span>
                        <span style="color: #6b7280;">⏱ ${response.responseTime}</span>
                        <span style="color: #6b7280;">📦 ${this.formatBytes(response.size)}</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <button class="btn btn-sm" onclick="app.saveQuickTestAsTestCase()"
                            style="font-size:0.78rem;background:#f0fdf4;border-color:#86efac;color:#16a34a;">
                            💾 Save as Test Case
                        </button>
                        <button class="btn-text" onclick="document.getElementById('qt-response-container').innerHTML = ''">
                            Clear
                        </button>
                    </div>
                </div>
                <div class="response-body">
                    <pre>${JSON.stringify(response.body, null, 2)}</pre>
                </div>
            </div>
        `;
    },

    /**
     * Render Request Builder for selected endpoint
     */
    renderRequestBuilder(endpoint) {
    const baseUrl = (typeof app !== 'undefined' && app.state?.baseUrl) || 'http://localhost:8080';
    // Delegate to shared helper so the rule is identical everywhere
    const fullUrl = (typeof app !== 'undefined' && app._buildUrl)
        ? app._buildUrl(endpoint.path, baseUrl)
        : (/^(https?:\/\/|\{\{)/.test(endpoint.path) ? endpoint.path : baseUrl + endpoint.path);
   return `
        <div class="request-builder">
            <!-- Header Section -->
            <div class="request-header" style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; background: white;">
                <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">
                    ${endpoint.summary || endpoint.path}
                </h2>

                <!-- Base URL bar -->
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                    <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; white-space: nowrap;">BASE URL</span>
                    <input
                        type="text"
                        id="base-url-input"
                        value="${baseUrl}"
                        placeholder="http://localhost:8080"
                        onchange="app.setBaseUrl(this.value)"
                        style="flex: 1; border: none; background: transparent; font-family: 'Courier New', monospace; font-size: 0.875rem; outline: none; color: #1e293b;"
                    />
                </div>

                <!-- Method + URL -->
                <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
                    <select id="request-method" class="form-control" style="width: 120px; font-weight: 600;">
                        <option value="GET" ${endpoint.method === 'GET' ? 'selected' : ''}>GET</option>
                        <option value="POST" ${endpoint.method === 'POST' ? 'selected' : ''}>POST</option>
                        <option value="PUT" ${endpoint.method === 'PUT' ? 'selected' : ''}>PUT</option>
                        <option value="DELETE" ${endpoint.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                        <option value="PATCH" ${endpoint.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
                    </select>

                    <input
                        type="text"
                        id="request-url"
                        class="form-control"
                        value="${fullUrl}"
                        placeholder="https://api.example.com/endpoint"
                        style="flex: 1; font-family: 'Courier New', monospace;"
                    />

                    <button class="btn btn-primary" onclick="app.sendRequest()" style="min-width: 120px;">
                        🚀 Send
                    </button>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-success" onclick="app.fillWithFakeData(${endpoint.id})">
                        🎲 Fill with Fake Data
                    </button>
                    <button class="btn btn-secondary" onclick="app.saveAsTestCase()">
                        💾 Save as Test Case
                    </button>
                    <button class="btn" onclick="app.clearRequestBuilder()">
                        🗑️ Clear
                    </button>
                    <div style="margin-left:auto;display:flex;align-items:center;gap:0.5rem;">
                        <label style="font-size:0.78rem;font-weight:600;color:#64748b;white-space:nowrap;">🔐 Client Cert</label>
                        <select id="rb-cert" class="form-control" style="width:180px;font-size:0.82rem;">
                            <option value="">— None —</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Tabs Section -->
            <div class="request-tabs">
                <!-- Tab Headers -->
                <div class="tab-headers" style="display: flex; border-bottom: 2px solid #e5e7eb; background: #f9fafb;">
                    <button class="tab-header active" data-tab="params" onclick="app.switchTab('params')">
                        Params
                    </button>
                    <button class="tab-header" data-tab="headers" onclick="app.switchTab('headers')">
                        Headers
                    </button>
                    <button class="tab-header" data-tab="body" onclick="app.switchTab('body')">
                        Body
                    </button>
                    <button class="tab-header" data-tab="auth" onclick="app.switchTab('auth')">
                        Auth
                    </button>
                    <button class="tab-header" data-tab="assertions" onclick="app.switchTab('assertions')">
                        Assertions
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="tab-content" style="padding: 1.5rem; background: white;">

                    <!-- Params Tab -->
                    <div id="tab-params" class="tab-pane active">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="font-size: 1rem; font-weight: 600;">Query Parameters</h3>
                            <button class="btn btn-sm" onclick="app.addParam()">+ Add Parameter</button>
                        </div>

                        <div class="kv-list-header" style="display: grid; grid-template-columns: 1fr 1fr 1fr 40px; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem; background: #f9fafb; border-radius: 4px; font-weight: 600; font-size: 0.875rem; color: #64748b;">
                            <div>Key</div>
                            <div>Value</div>
                            <div>Description</div>
                            <div></div>
                        </div>

                        <div id="params-list" class="kv-list">
                            <!-- Params will be added here -->
                        </div>
                    </div>

                    <!-- Headers Tab -->
                    <div id="tab-headers" class="tab-pane" style="display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="font-size: 1rem; font-weight: 600;">Request Headers</h3>
                            <button class="btn btn-sm" onclick="app.addHeader()">+ Add Header</button>
                        </div>

                        <div class="kv-list-header" style="display: grid; grid-template-columns: 1fr 1fr 1fr 40px; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem; background: #f9fafb; border-radius: 4px; font-weight: 600; font-size: 0.875rem; color: #64748b;">
                            <div>Key</div>
                            <div>Value</div>
                            <div>Description</div>
                            <div></div>
                        </div>

                        <div id="headers-list" class="kv-list">
                            <div class="kv-row">
                                <input type="text" class="form-control" value="Content-Type" placeholder="Header name">
                                <input type="text" class="form-control" value="application/json" placeholder="Header value">
                                <input type="text" class="form-control" placeholder="Description (optional)">
                                <button class="btn-icon" onclick="this.parentElement.remove()">×</button>
                            </div>
                        </div>
                    </div>

                    <!-- Body Tab -->
                    <div id="tab-body" class="tab-pane" style="display: none;">
                        <div style="margin-bottom: 1rem;">
                            <label class="form-label">Body Type</label>
                            <select id="body-type" class="form-control" style="max-width: 200px;" onchange="app.changeBodyType()">
                                <option value="none">None</option>
                                <option value="json" selected>JSON</option>
                                <option value="form-data">Form Data</option>
                                <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
                                <option value="raw">Raw</option>
                            </select>
                        </div>

                        <div id="body-content">
                            <textarea
                                id="request-body"
                                class="form-control"
                                rows="15"
                                placeholder='{\n  "key": "value"\n}'
                                style="font-family: 'Courier New', monospace; font-size: 0.9rem;"
                            ></textarea>
                        </div>
                    </div>

                    <!-- Auth Tab -->
                    <div id="tab-auth" class="tab-pane" style="display: none;">
                        <div style="margin-bottom: 1rem;">
                            <label class="form-label">Authorization Type</label>
                            <select id="auth-type" class="form-control" style="max-width: 250px;" onchange="app.changeAuthType()">
                                <option value="none">No Auth</option>
                                <option value="bearer">Bearer Token</option>
                                <option value="basic">Basic Auth</option>
                                <option value="api-key">API Key</option>
                                <option value="oauth2">OAuth 2.0</option>
                            </select>
                        </div>

                        <div id="auth-content">
                            <p style="color: #64748b; font-size: 0.9rem;">
                                Select an authorization type above to configure authentication.
                            </p>
                        </div>
                    </div>

                    <!-- Assertions Tab -->
                    <div id="tab-assertions" class="tab-pane" style="display: none;">
                        <div style="margin-bottom: 1rem;">
                            <label class="form-label">Expected Status Code</label>
                            <input type="number" id="assert-expected-status" class="form-control" value="200" style="max-width: 150px;">
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <label class="form-label" style="margin: 0;">Response Assertions</label>
                                <button class="btn btn-sm" onclick="app.addRequestAssertion()">+ Add Assertion</button>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 160px 1fr 32px; gap: 0.4rem; padding: 0.4rem 0.5rem; background: #f9fafb; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: #6b7280; margin-bottom: 0.4rem;">
                                <span>Field (dot notation)</span><span>Operator</span><span>Expected Value</span><span></span>
                            </div>
                            <div id="request-assertions-list" style="display: flex; flex-direction: column; gap: 0.4rem;">
                                <!-- rows added dynamically -->
                            </div>
                            <p style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.5rem;">
                                Body examples: <code>data.user.name</code>, <code>data.items[0].id</code>, <code>meta.total</code><br>
                                Header examples: <code>header.content-type</code>, <code>header.x-request-id</code>
                            </p>
                        </div>

                        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                            <div id="assertion-results" style="display: none;">
                                <!-- Results shown after Send -->
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Response Section -->
            <div id="response-section" style="display: none; border-top: 2px solid #e5e7eb;">
                <div style="padding: 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                    <h3 style="font-size: 1rem; font-weight: 600;">Response</h3>
                </div>
                <div id="response-content" style="padding: 1.5rem;">
                    <!-- Response will appear here -->
                </div>
            </div>
        </div>
    `;
    },

    /**
     * Show Save as Test Case modal
     */
    showSaveAsTestCaseModal(requestData) {
        const workspaceId = app.state.activeWorkspace;

        const content = `
            <div class="save-test-case-modal">
                <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem;">
                    Save the current request configuration as a reusable test case.
                </p>

                <!-- Test Suite Selection -->
                <div class="form-group">
                    <label class="form-label">Test Suite *</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <select id="test-suite-select" class="form-control" style="flex: 1;">
                            <option value="">Loading test suites...</option>
                        </select>
                        <button class="btn btn-secondary" onclick="app.showCreateTestSuiteModal()" style="white-space: nowrap;">
                            + New Suite
                        </button>
                    </div>
                    <p style="font-size: 0.875rem; color: #64748b; margin-top: 0.5rem;">
                        Select an existing test suite or create a new one
                    </p>
                </div>

                <!-- Test Case Name -->
                <div class="form-group">
                    <label class="form-label">Test Case Name *</label>
                    <input
                        type="text"
                        id="test-case-name"
                        class="form-control"
                        placeholder="e.g., Valid user login"
                        value="${requestData.suggestedName || ''}"
                    />
                </div>

                <!-- Description -->
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea
                        id="test-case-description"
                        class="form-control"
                        rows="3"
                        placeholder="Describe what this test case validates..."
                    >${requestData.description || ''}</textarea>
                </div>

                <!-- Path Parameters (auto-detected from endpoint) -->
                ${(() => {
                    const params = (requestData.endpoint || '').match(/\{([^}]+)\}/g);
                    if (!params || params.length === 0) return '';
                    return `
                        <div class="form-group">
                            <label class="form-label">Path Parameters</label>
                            <p style="font-size:0.8rem; color:#6b7280; margin-bottom:0.5rem;">Fill in values for the path parameters in <code>${requestData.endpoint}</code></p>
                            ${params.map(p => {
                                const name = p.slice(1, -1);
                                return `
                                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                                    <label style="min-width:120px; font-size:0.85rem; color:#374151;">{${name}}</label>
                                    <input type="text" id="path-param-${name}" class="form-control" placeholder="value for ${name}">
                                </div>`;
                            }).join('')}
                        </div>
                    `;
                })()}

                <!-- Expected Status Code -->
                <div class="form-group">
                    <label class="form-label">Expected Status Code</label>
                    <input
                        type="number"
                        id="expected-status"
                        class="form-control"
                        value="200"
                        min="100"
                        max="599"
                        style="max-width: 150px;"
                    />
                </div>

                <!-- Preview -->
                <div style="padding: 1rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.75rem; color: #64748b;">
                        📋 Request Preview
                    </h4>
                    <div style="font-family: 'Courier New', monospace; font-size: 0.85rem;">
                        <div style="margin-bottom: 0.5rem;">
                            <span style="font-weight: 600; color: ${this.getMethodColor(requestData.method)};">
                                ${requestData.method}
                            </span>
                            <span style="color: #64748b; margin-left: 0.5rem;">${requestData.endpoint}</span>
                        </div>
                        ${requestData.params && Object.keys(requestData.params).length > 0 ?
                            `<div style="color: #64748b;">Params: ${Object.keys(requestData.params).length} parameter(s)</div>` : ''}
                        ${requestData.headers && Object.keys(requestData.headers).length > 0 ?
                            `<div style="color: #64748b;">Headers: ${Object.keys(requestData.headers).length} header(s)</div>` : ''}
                        ${requestData.body ?
                            `<div style="color: #64748b;">Body: ${typeof requestData.body === 'object' ? 'JSON' : 'Raw'}</div>` : ''}
                    </div>
                </div>
            </div>
        `;

        const actions = `
            <button class="btn btn-text" onclick="document.getElementById('modal-container').innerHTML = ''">
                Cancel
            </button>
            <button class="btn btn-primary" onclick="app.confirmSaveTestCase()">
                💾 Save Test Case
            </button>
        `;

        this.showModal('Save as Test Case', content, actions);

        // Load test suites after modal is shown
        app.loadTestSuitesForDropdown(workspaceId);
    },

    /**
     * Get method color
     */
    getMethodColor(method) {
        const colors = {
            'GET': '#3b82f6',
            'POST': '#10b981',
            'PUT': '#f59e0b',
            'DELETE': '#ef4444',
            'PATCH': '#8b5cf6'
        };
        return colors[method] || '#64748b';
    },

    /**
     * Show Create Test Suite modal
     */
    showCreateTestSuiteModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Suite Name *</label>
                <input
                    type="text"
                    id="new-suite-name"
                    class="form-control"
                    placeholder="e.g., Authentication Tests"
                    autofocus
                />
            </div>

            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea
                    id="new-suite-description"
                    class="form-control"
                    rows="3"
                    placeholder="Describe this test suite..."
                ></textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Suite Type</label>
                <select id="new-suite-type" class="form-control">
                    <option value="regression"> Regression</option>
                    <option value="smoke"> Smoke</option>
                    <option value="integration"> Integration</option>
                    <option value="positive"> Positive</option>
                    <option value="negative"> Negative</option>
                    <option value="custom"> Custom</option>
                </select>
            </div>
        `;

        const actions = `
            <button class="btn btn-text" onclick="app.cancelCreateSuite()">
                Cancel
            </button>
            <button class="btn btn-primary" onclick="app.confirmCreateTestSuite()">
                ✅ Create Suite
            </button>
        `;

        this.showModal('Create New Test Suite', content, actions);
    },

    /**
     * Render Test Cases View
     */
    renderTestCases(testSuites, testCases) {
        const allTestCases = testCases || [];
        const passed = allTestCases.filter(t => t.lastRunStatus === 'passed').length;
        const failed = allTestCases.filter(t => t.lastRunStatus === 'failed').length;
        const notRun = allTestCases.filter(t => !t.lastRunStatus || t.lastRunStatus === 'not-run').length;

        return `
            <div class="test-cases-container" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Test Cases</h2>
                        <div style="display: flex; gap: 1rem; font-size: 0.875rem;">
                            <span> ${passed} Passed</span>
                            <span> ${failed} Failed</span>
                            <span> ${notRun} Not Run</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" onclick="app.showCreateSuiteModal()">+ New Suite</button>
                        <button class="btn btn-success" onclick="app.showCreateTestCaseModal()">+ New Test</button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 300px 1fr; gap: 1.5rem;">
                    <!-- Left: Test Suites -->
                    <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; background: white; height: fit-content;">
                        <h3 style="font-weight: 600; margin-bottom: 1rem; font-size: 1rem;">Test Suites</h3>
                        ${testSuites.length === 0 ? `
                            <div style="text-align: center; padding: 2rem; color: #9ca3af;">
                                <p>No test suites yet</p>
                                <button class="btn btn-sm btn-primary" onclick="app.showCreateSuiteModal()" style="margin-top: 1rem;">Create First Suite</button>
                            </div>
                        ` : `
                            <div id="test-suites-list">
                                ${testSuites.map(suite => this.renderTestSuiteCard(suite)).join('')}
                            </div>
                        `}
                    </div>

                    <!-- Right: Test Cases in Selected Suite -->
                    <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; background: white;">
                        ${allTestCases.length === 0 ? `
                            <div style="text-align: center; padding: 3rem; color: #9ca3af;">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 64px; height: 64px; margin: 0 auto 1rem; color: #d1d5db;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                </svg>
                                <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">No test cases yet</h3>
                                <p style="margin-bottom: 1rem;">Create test cases to validate your API endpoints</p>
                                <button class="btn btn-primary" onclick="app.showCreateTestCaseModal()">Create First Test</button>
                            </div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h3 style="font-weight: 600; font-size: 1rem;">${allTestCases.length} Test Cases</h3>
                                <button class="btn btn-primary btn-sm" onclick="app.runAllTestsInSuite()">▶ Run All</button>
                            </div>
                            <div id="tc-progress-container"></div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                ${allTestCases.map(test => this.renderTestCaseCard(test)).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render individual test item
     */
    renderTestItem(test) {
        const statusClass = test.status === 'passed' ? 'test-status-passed' :
                           test.status === 'failed' ? 'test-status-failed' :
                           'test-status-not-run';

        const statusIcon = test.status === 'passed' ? '✓' :
                          test.status === 'failed' ? '✗' :
                          '○';

        return `
            <div class="test-item" onclick="app.selectTestCase(${test.id})">
                <div class="test-item-header">
                    <div class="test-item-name">${test.name}</div>
                    <div class="test-status-icon ${statusClass}">${statusIcon}</div>
                </div>
                <div class="test-item-meta">
                    <span class="method-badge method-${test.method.toLowerCase()}">${test.method}</span>
                    <span>${test.endpoint}</span>
                </div>
                ${test.tags && test.tags.length > 0 ? `
                    <div class="test-tags">
                        ${test.tags.map(tag => `<span class="test-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render Test Case Detail
     */
    renderTestDetail(test) {
        return `
            <div class="test-detail-header">
                <div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">${test.name}</h3>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="method-badge method-${test.method.toLowerCase()}">${test.method}</span>
                        <code style="font-family: monospace; color: #6b7280;">${test.endpoint}</code>
                    </div>
                </div>
                <div class="test-detail-actions">
                    <button class="btn btn-primary" onclick="app.runTestCase(${test.id})">
                        Run Test
                    </button>
                    <button class="btn btn-text" onclick="app.editTestCase(${test.id})">
                        Edit
                    </button>
                </div>
            </div>

            <div style="margin-top: 1.5rem;">
                <h4 style="font-weight: 600; margin-bottom: 0.75rem;">Request Configuration</h4>
                <div style="background: #f9fafb; border-radius: 0.5rem; padding: 1rem;">
                    <pre style="font-family: monospace; font-size: 0.875rem;">${JSON.stringify(test.request || {}, null, 2)}</pre>
                </div>
            </div>

            ${test.assertions && test.assertions.length > 0 ? `
                <div style="margin-top: 1.5rem;">
                    <h4 style="font-weight: 600; margin-bottom: 0.75rem;">Assertions</h4>
                    ${test.assertions.map(assertion => `
                        <div class="assertion ${assertion.passed ? 'passed' : 'failed'}">
                            <div class="assertion-name">${assertion.passed ? '✓' : '✗'} ${assertion.name}</div>
                            <div class="assertion-detail">${assertion.detail || ''}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${test.lastRun ? `
                <div style="margin-top: 1.5rem;">
                    <h4 style="font-weight: 600; margin-bottom: 0.75rem;">Last Execution</h4>
                    <div class="response-card">
                        <div class="response-header">
                            <div class="response-meta">
                                <span class="${test.lastRun.status >= 200 && test.lastRun.status < 300 ? 'status-success' : 'status-error'}">
                                    Status: ${test.lastRun.status}
                                </span>
                                <span style="color: #6b7280;">⏱ ${test.lastRun.responseTime}</span>
                            </div>
                        </div>
                        <div class="response-body">
                            <pre>${JSON.stringify(test.lastRun.response, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    },

    /**
     * Render Load Test Configuration
     */
    renderLoadTest(endpoints = [], baseUrl = 'http://localhost:8080', swaggerFiles = []) {
        const swaggerOptions = swaggerFiles.map(s =>
            `<option value="${s.id}">${s.name || s.fileName || 'Swagger ' + s.id}</option>`
        ).join('');

        const fakeTags = ['fake.name','fake.email','fake.phone','fake.uuid','fake.number',
            'fake.decimal','fake.boolean','fake.word','fake.sentence','fake.address',
            'fake.city','fake.country','fake.url','fake.username','fake.password',
            'fake.company','fake.date','fake.timestamp','fake.color','fake.ip'];

        const fakeChips = fakeTags.map(t =>
            `<span onclick="app.insertFakePlaceholder('load-body','{{${t}}}')"
                   style="display:inline-block;padding:2px 8px;margin:2px;background:#eff6ff;color:#3b82f6;
                          border:1px solid #bfdbfe;border-radius:9999px;font-size:0.75rem;cursor:pointer;font-family:monospace;"
                   title="Click to insert">{{${t}}}</span>`
        ).join('');

        return `
        <div style="padding:1.5rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
                <h2 style="font-size:1.5rem;font-weight:700;">Load Testing</h2>
            </div>

            <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:1.25rem;margin-bottom:1.25rem;">

                <!-- Left: Target + Body -->
                <div style="display:flex;flex-direction:column;gap:1rem;">
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;">
                        <h3 style="font-weight:600;margin-bottom:1rem;">Target</h3>

                        <div class="form-group">
                            <label class="form-label">Base URL</label>
                            <input type="text" id="load-baseurl" class="form-control" value="${baseUrl}"
                                   placeholder="http://localhost:8080" style="font-family:monospace;"
                                   oninput="app.setBaseUrl(this.value)">
                        </div>

                        ${swaggerOptions ? `
                        <div class="form-group">
                            <label class="form-label">Swagger Spec</label>
                            <select id="load-swagger-picker" class="form-control"
                                    onchange="app._loadTestSwaggerChanged(this.value)">
                                <option value="">— select swagger —</option>
                                ${swaggerOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Endpoint
                                <span id="load-body-autofill-spinner" style="display:none;margin-left:6px;font-size:0.75rem;color:#6b7280;">⏳ loading…</span>
                            </label>
                            <select id="load-endpoint-picker" class="form-control"
                                    onchange="app._pickLoadEndpoint(this)">
                                <option value="">— select swagger first —</option>
                            </select>
                        </div>` : ''}

                        <div class="form-group">
                            <label class="form-label">Method &amp; Path</label>
                            <div style="display:flex;gap:0.5rem;">
                                <select id="load-method" class="form-control" style="flex:0 0 100px;" onchange="app._updateLoadBodyVisibility()">
                                    ${['GET','POST','PUT','DELETE','PATCH'].map(m => `<option>${m}</option>`).join('')}
                                </select>
                                <input type="text" id="load-path" class="form-control" placeholder="/api/endpoint"
                                       style="font-family:monospace;" oninput="app._syncLoadUrl()">
                            </div>
                        </div>

                        <!-- Path parameter inputs — populated dynamically by _updateLoadPathParams() -->
                        <div id="load-path-params"></div>

                        <div class="form-group">
                            <label class="form-label">Headers <span style="font-size:0.75rem;color:#9ca3af;">(JSON)</span></label>
                            <textarea id="load-headers" class="form-control" rows="2"
                                      style="font-family:monospace;font-size:0.85rem;">{"Content-Type":"application/json"}</textarea>
                        </div>
                        <div class="form-group" id="load-cert-group" style="margin-top:0.75rem;">
                            <label class="form-label">Client Certificate <span style="font-weight:400;color:#9ca3af;">(optional)</span></label>
                            <select id="load-cert" class="form-control">
                                <option value="">— None —</option>
                            </select>
                            <div style="font-size:0.75rem;color:#9ca3af;margin-top:3px;">Select a certificate from the Certificates tab for mTLS endpoints</div>
                        </div>
                    </div>

                    <!-- Body with fake data -->
                    <div id="load-body-section" style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;">
                        <div style="margin-bottom:0.75rem;">
                            <h3 style="font-weight:600;">Request Body</h3>
                        </div>
                        <textarea id="load-body" class="form-control" rows="5"
                                  style="font-family:monospace;font-size:0.85rem;"
                                  placeholder='{"name":"{{fake.name}}","email":"{{fake.email}}"}'></textarea>
                        <div style="margin-top:0.6rem;">
                            <div style="font-size:0.75rem;color:#6b7280;margin-bottom:4px;font-weight:600;">
                                Click to insert placeholder:
                            </div>
                            ${fakeChips}
                        </div>
                    </div>
                </div>

                <!-- Right: Config + Thresholds -->
                <div style="display:flex;flex-direction:column;gap:1rem;">
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;">
                        <h3 style="font-weight:600;margin-bottom:1rem;">Configuration</h3>
                        <!-- Limits reference bar -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:1rem;">
                            ${[
                                ['Virtual Users',  '1 – 50'],
                                ['Duration',       '1 – 300 s'],
                                ['Ramp-up',        '0 – 120 s'],
                                ['Think Time',     '50 – 30 000 ms']
                            ].map(([k,v]) => `
                                <div style="background:#f1f5f9;border-radius:5px;padding:4px 8px;font-size:0.75rem;">
                                    <span style="color:#6b7280;">${k}</span>
                                    <span style="float:right;font-weight:600;color:#374151;font-family:monospace;">${v}</span>
                                </div>`).join('')}
                        </div>

                        <div class="form-group">
                            <label class="form-label">Virtual Users</label>
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                <input type="number" id="load-vus" value="10" min="1" max="50" step="1"
                                       class="form-control" style="flex:1;"
                                       oninput="app._clampInput(this,1,50)">
                                <span id="load-vus-hint" style="font-size:0.72rem;color:#9ca3af;white-space:nowrap;">max 50</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Duration <span style="font-size:0.72rem;color:#9ca3af;font-weight:400;">(seconds)</span></label>
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                <input type="number" id="load-duration" value="30" min="1" max="300" step="1"
                                       class="form-control" style="flex:1;"
                                       oninput="app._clampInput(this,1,300)">
                                <span id="load-duration-hint" style="font-size:0.72rem;color:#9ca3af;white-space:nowrap;">max 300 s (5 min)</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Ramp-up <span style="font-size:0.72rem;color:#9ca3af;font-weight:400;">(seconds)</span></label>
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                <input type="number" id="load-rampup" value="5" min="0" max="120" step="1"
                                       class="form-control" style="flex:1;"
                                       oninput="app._clampInput(this,0,120)">
                                <span id="load-rampup-hint" style="font-size:0.72rem;color:#9ca3af;white-space:nowrap;">max 120 s (2 min)</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Think Time <span style="font-size:0.72rem;color:#9ca3af;font-weight:400;">(ms — min pause between requests per VU)</span></label>
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                <input type="number" id="load-thinktime" value="100" min="50" max="30000" step="50"
                                       class="form-control" style="flex:1;"
                                       oninput="app._clampInput(this,50,30000)">
                                <span id="load-thinktime-hint" style="font-size:0.72rem;color:#9ca3af;white-space:nowrap;">min 50 ms</span>
                            </div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:0.4rem;">
                            <button class="btn btn-secondary" onclick="app.previewFakeData()"
                                    style="width:100%;font-size:0.85rem;">
                                🔍 Preview Request
                            </button>
                            <div style="display:flex;gap:0.5rem;">
                                <button class="btn btn-warning" id="load-start-btn" onclick="app.startLoadTest()" style="flex:1;">
                                    ▶ Start Load Test
                                </button>
                                <button class="btn btn-text" id="load-stop-btn" onclick="app.stopLoadTest()"
                                        style="display:none;color:#dc2626;">Stop</button>
                            </div>
                        </div>
                    </div>

                    <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;">
                        <h3 style="font-weight:600;margin-bottom:0.75rem;">Thresholds</h3>
                        <div class="form-group">
                            <label class="form-label" style="font-size:0.8rem;">P95 Response Time</label>
                            <input type="text" id="thresh-p95" value="500" class="form-control"
                                   style="font-size:0.85rem;" placeholder="ms">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="font-size:0.8rem;">Max Error Rate (%)</label>
                            <input type="text" id="thresh-err" value="1" class="form-control"
                                   style="font-size:0.85rem;" placeholder="%">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="font-size:0.8rem;">Min Throughput (RPS)</label>
                            <input type="text" id="thresh-rps" value="10" class="form-control"
                                   style="font-size:0.85rem;" placeholder="rps">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Progress + Results -->
            <div id="load-test-results"></div>
        </div>`;
    },

    /**
     * Render Mock Server Configuration
     */
    renderMockServer(swaggerFiles = [], mockStatus = {}, defaultSwaggerId = null) {
        const running = mockStatus.running === true;
        const selectedId = mockStatus.swaggerFileId || defaultSwaggerId;
        const swaggerOptions = swaggerFiles.map(s =>
            `<option value="${s.id}" ${selectedId == s.id ? 'selected' : ''}>${s.name}</option>`
        ).join('');

        const activeEndpoints = (mockStatus.endpoints || []).map(e =>
            `<div style="font-family:monospace;font-size:0.8rem;padding:3px 0;border-bottom:1px solid #f1f5f9;">${e}</div>`
        ).join('') || '<div style="color:#9ca3af;font-size:0.85rem;">No endpoints loaded</div>';

        return `
            <div style="padding:1.5rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
                    <h2 style="font-size:1.5rem;font-weight:700;">Mock Server</h2>
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <span id="mock-status-dot" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.875rem;font-weight:600;color:${running ? '#059669' : '#6b7280'};">
                            <span style="width:10px;height:10px;border-radius:50%;background:${running ? '#10b981' : '#9ca3af'};${running ? 'box-shadow:0 0 0 3px #d1fae5;' : ''}"></span>
                            ${running ? 'Running on :' + mockStatus.port : 'Stopped'}
                        </span>
                    </div>
                </div>

                <!-- Config card -->
                <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.5rem;margin-bottom:1.25rem;">
                    <h3 style="font-weight:600;margin-bottom:1rem;">Configuration</h3>
                    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:1rem;margin-bottom:1rem;">
                        <div class="form-group" style="margin:0;">
                            <label class="form-label">Swagger Specification</label>
                            <select id="mock-swagger-id" class="form-control" ${running ? 'disabled' : ''}>
                                <option value="">-- select a swagger file --</option>
                                ${swaggerOptions}
                            </select>
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label class="form-label">Port</label>
                            <input type="number" id="mock-port" value="${mockStatus.port || 8765}" class="form-control" ${running ? 'disabled' : ''}>
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label class="form-label">Delay (ms)</label>
                            <input type="number" id="mock-delay" value="0" min="0" class="form-control" ${running ? 'disabled' : ''}>
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label class="form-label">Response Strategy</label>
                            <select id="mock-strategy" class="form-control" ${running ? 'disabled' : ''}>
                                <option value="smart">Smart Fake Data</option>
                                <option value="empty">Empty Response</option>
                                <option value="error">Always Error</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.75rem;">
                        <button class="btn ${running ? 'btn-warning' : 'btn-success'}" id="mock-toggle-btn" onclick="app.toggleMockServer()">
                            ${running ? '⏹ Stop Server' : '▶ Start Server'}
                        </button>
                        ${running ? `<span style="font-size:0.85rem;color:#6b7280;align-self:center;">Hit endpoints at: <code>http://localhost:${mockStatus.port}</code></span>` : ''}
                    </div>
                </div>

                <!-- Active endpoints -->
                <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;margin-bottom:1.25rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                        <h3 style="font-weight:600;">Mocked Endpoints <span style="font-size:0.8rem;font-weight:400;color:#6b7280;">(${(mockStatus.endpoints || []).length})</span></h3>
                    </div>
                    <div style="max-height:180px;overflow-y:auto;">${activeEndpoints}</div>
                </div>

                <!-- Request Logs -->
                <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:1.25rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                        <h3 style="font-weight:600;">Request Logs</h3>
                        <div style="display:flex;gap:0.5rem;">
                            <button class="btn btn-text" style="font-size:0.8rem;" onclick="app.clearMockLogs()">Clear</button>
                            <button class="btn btn-text" style="font-size:0.8rem;" onclick="app.refreshMockLogs()">↻ Refresh</button>
                        </div>
                    </div>
                    <div id="mock-logs-content" style="background:#0f172a;color:#a3e635;padding:1rem;border-radius:6px;font-family:monospace;font-size:0.8rem;height:320px;overflow-y:auto;line-height:1.6;">
                        <span style="color:#475569;">Waiting for requests...</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render Swagger Card
     */
    renderSwaggerCard(swagger, selected = false) {
    return `
           <div class="swagger-card ${selected ? 'swagger-card-selected' : ''}"
                onclick="app.selectSwagger(${swagger.id})"
                style="cursor: pointer; transition: all 0.2s; position: relative; padding: 1rem; margin-bottom: 0.5rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; ${selected ? 'background: #eff6ff; border-left: 3px solid #3b82f6;' : ''}">
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                   <div style="font-weight: 600; font-size: 0.875rem;">${swagger.name}</div>
                   <div onclick="event.stopPropagation()">
                       <button onclick="app.deleteSwagger(${swagger.id}); event.stopPropagation();"
                               title="Delete"
                               style="width: 24px; height: 24px; border: 1px solid #e5e7eb; background: white; border-radius: 4px; cursor: pointer; font-size: 16px; color: #dc2626;">
                           ×
                       </button>
                   </div>
               </div>
               <div style="display: flex; gap: 0.5rem; font-size: 0.75rem; color: #6b7280;">
                   ${swagger.endpointCount != null ? `<span>${swagger.endpointCount} endpoints</span>` : ''}
                   <span>· ${new Date(swagger.createdAt).toLocaleDateString()}</span>
               </div>
               ${selected ? '<div style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); width: 8px; height: 8px; background: #3b82f6; border-radius: 50%;"></div>' : ''}
           </div>
       `;
    },

    /**
     * Render Endpoint Card
     */
    renderEndpointCard(endpoint, isSelected) {
        return `
            <div class="endpoint-card ${isSelected ? 'selected' : ''}" onclick="app.selectEndpoint(${endpoint.id})">
                <div class="endpoint-header">
                    <span class="method-badge method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                    <code class="endpoint-path">${endpoint.path}</code>
                </div>
                <p class="endpoint-summary">${endpoint.summary || ''}</p>
            </div>
        `;
    },

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Render Documentation View
     */
    renderDocumentation(endpoints, swaggerName) {
        const groupedEndpoints = {};
        endpoints.forEach(endpoint => {
            const tag = endpoint.tags?.[0] || 'General';
            if (!groupedEndpoints[tag]) {
                groupedEndpoints[tag] = [];
            }
            groupedEndpoints[tag].push(endpoint);
        });

        return `
            <div class="documentation-view">
                <div class="docs-header">
                    <div>
                        <h2>API Documentation</h2>
                        <p style="color: #6b7280; margin-top: 0.25rem; font-size: 0.875rem;">
                            ${swaggerName ? `📄 ${swaggerName}` : 'Auto-generated from Swagger specification'}
                        </p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <input type="text" id="docs-search" class="form-control" placeholder="Search endpoints…"
                            style="width: 220px;" oninput="app.filterDocs()">
                        <select id="docs-method-filter" class="endpoint-method-select" style="height: 38px;" onchange="app.filterDocs()">
                            <option value="">All Methods</option>
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>
                </div>

                <div id="docs-content" class="docs-content">
                    ${Object.entries(groupedEndpoints).map(([tag, tagEndpoints]) => `
                        <div class="docs-section">
                            <h3 class="docs-section-title">${tag}</h3>
                            ${tagEndpoints.map(endpoint => `
                                <div class="docs-endpoint">
                                    <div class="docs-endpoint-header">
                                        <div style="display: flex; align-items: center; gap: 1rem;">
                                            <span class="method-badge method-${endpoint.method}">${endpoint.method}</span>
                                            <code class="docs-path">${endpoint.path}</code>
                                        </div>
                                        <button class="btn-text" onclick="app.selectEndpoint(${endpoint.id})">
                                            Try it →
                                        </button>
                                    </div>
                                    ${endpoint.summary ? `
                                        <p class="docs-summary">${endpoint.summary}</p>
                                    ` : ''}
                                    ${endpoint.description ? `
                                        <div class="docs-description">
                                            <p>${endpoint.description}</p>
                                        </div>
                                    ` : ''}

                                    <!-- Request Parameters -->
                                    ${this.renderEndpointParameters(endpoint)}

                                    <!-- Response Examples -->
                                    ${this.renderEndpointResponses(endpoint)}
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderEndpointParameters(endpoint) {
        // Mock parameters for demonstration
        const hasParams = ['POST', 'PUT', 'PATCH'].includes(endpoint.method) || endpoint.path.includes('{');

        if (!hasParams) return '';

        return `
            <div class="docs-params">
                <h4 class="docs-subsection-title">Parameters</h4>
                ${endpoint.path.includes('{') ? `
                    <div class="docs-param">
                        <div class="docs-param-header">
                            <span class="docs-param-name">Path Parameters</span>
                        </div>
                        ${endpoint.path.match(/\{([^}]+)\}/g)?.map(param => `
                            <div class="docs-param-item">
                                <code>${param.replace(/[{}]/g, '')}</code>
                                <span class="docs-param-type">string</span>
                                <span class="docs-param-required">required</span>
                            </div>
                        `).join('') || ''}
                    </div>
                ` : ''}
                ${['POST', 'PUT', 'PATCH'].includes(endpoint.method) ? `
                    <div class="docs-param">
                        <div class="docs-param-header">
                            <span class="docs-param-name">Request Body</span>
                        </div>
                        <div class="docs-code-block">
                            <pre>${this.getExampleRequestBody(endpoint)}</pre>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderEndpointResponses(endpoint) {
        return `
            <div class="docs-responses">
                <h4 class="docs-subsection-title">Responses</h4>
                <div class="docs-response">
                    <div class="docs-response-header">
                        <span class="status-success">200 OK</span>
                        <span style="color: #6b7280; font-size: 0.875rem;">Success</span>
                    </div>
                    <div class="docs-code-block">
                        <pre>${this.getExampleResponse(endpoint)}</pre>
                    </div>
                </div>
            </div>
        `;
    },

    getExampleRequestBody(endpoint) {
        const examples = {
            'POST': `{
  "transactionId": "TXN123456",
  "amount": 1500.00,
  "currency": "USD",
  "timestamp": "2024-03-20T10:30:00Z"
}`,
            'PUT': `{
  "name": "Updated Rule Name",
  "conditions": {...},
  "actions": {...}
}`,
            'PATCH': `{
  "status": "active"
}`
        };
        return examples[endpoint.method] || '{}';
    },

    getExampleResponse(endpoint) {
        const responses = {
            '/api/fraud/validate': `{
  "fraudScore": 0.85,
  "decision": "REVIEW",
  "factors": ["high_amount", "new_merchant"],
  "transactionId": "TXN123456"
}`,
            '/api/fraud/rules': `[
  {
    "id": 1,
    "name": "High Risk Transaction",
    "enabled": true,
    "priority": 100
  }
]`,
            'default': `{
  "status": "success",
  "data": {...}
}`
        };
        return responses[endpoint.path] || responses['default'];
    },

    /**
     * Render empty state
     */
    renderEmptyState(title, message, action = null) {
        return `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h2>${title}</h2>
                <p>${message}</p>
                ${action ? `<button class="btn btn-primary" onclick="${action.onClick}">${action.label}</button>` : ''}
            </div>
        `;
    },

renderTestSuiteCard(suite) {
    const icons = {
        regression: '🔄',
        positive: '✅',
        negative: '❌',
        smoke: '💨',
        integration: '🔗',
        custom: '📋'
    };

    const icon = icons[suite.type] || '📋';
    const selected = app.state.selectedSuiteId === suite.id;
    const prog = app.state.suiteRunProgress?.[suite.id];

    return `
        <div onclick="app.selectTestSuite(${suite.id})"
             style="padding: 0.75rem; border: 1px solid ${prog ? '#f59e0b' : selected ? '#3b82f6' : '#e5e7eb'}; border-radius: 0.5rem; cursor: pointer; margin-bottom: 0.5rem; transition: all 0.2s; background: ${prog ? '#fffbeb' : selected ? '#eff6ff' : ''};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
                    <span style="font-size: 1.25rem;">${icon}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${suite.name}</div>
                        <div style="font-size: 0.75rem; color: #6b7280;">${suite.description || ''}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0;">
                    <span id="suite-run-indicator-${suite.id}">
                        ${prog ? `<span class="suite-run-badge running"><span class="suite-progress-spinner"></span>${prog.completed}/${prog.total}</span>` : ''}
                    </span>
                    <div onclick="event.stopPropagation()" style="display: flex; gap: 0.25rem;">
                        <button onclick="app.runAllTestsInSuite(${suite.id}); event.stopPropagation();"
                                style="width: 24px; height: 24px; border: 1px solid #e5e7eb; background: white; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Run suite">
                            ▶
                        </button>
                        <button onclick="app.showEditSuiteModal(${suite.id}); event.stopPropagation();"
                                style="width: 24px; height: 24px; border: 1px solid #e5e7eb; background: white; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Edit">
                            ✏️
                        </button>
                        <button onclick="app.deleteTestSuite(${suite.id}); event.stopPropagation();"
                                style="width: 24px; height: 24px; border: 1px solid #e5e7eb; background: white; border-radius: 4px; cursor: pointer; font-size: 14px; color: #dc2626;" title="Delete">
                            ×
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
},
renderTestCaseCard(test) {
    const statusIcon = test.lastRunStatus === 'passed' ? '✅' :
                       test.lastRunStatus === 'failed' ? '❌' : '⭕';

    return `
        <div id="tc-card-${test.id}" style="padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; background: #f9fafb;">
            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <span id="tc-status-${test.id}" style="font-size: 1.25rem; min-width: 24px;">${statusIcon}</span>
                        <span style="font-weight: 600;">${test.name}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #6b7280;">
                        <span class="method-badge method-${test.method.toLowerCase()}" style="padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">${test.method}</span>
                        <span>${test.endpoint || test.url || ''}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="app.runTestCase(${test.id})" class="btn btn-sm btn-primary">Run</button>
                    <button onclick="app.showDataDrivenModal(${test.id}, '${(test.name || '').replace(/'/g, "\\'")}')" class="btn btn-sm" title="Data-Driven Test" style="background:#f0fdf4;border-color:#86efac;color:#16a34a;">&#9889; Data</button>
                    <button onclick="app.editTestCase(${test.id})" class="btn btn-sm">Edit</button>
                    <button onclick="app.deleteTestCase(${test.id})" style="width: 28px; height: 28px; border: 1px solid #e5e7eb; background: white; border-radius: 4px; cursor: pointer; color: #dc2626;">×</button>
                </div>
            </div>
            ${test.description ? `<p style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">${test.description}</p>` : ''}
        </div>
    `;
},
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
        `;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    renderDataDrivenModal(testId, testName) {
        return `
    <div id="data-driven-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding-top:4rem;overflow-y:auto;">
        <div style="background:white;border-radius:0.75rem;width:min(960px,95vw);max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <h2 style="font-size:1.1rem;font-weight:700;margin:0;">&#9889; Data-Driven Test</h2>
                    <p style="font-size:0.8rem;color:#6b7280;margin:0.2rem 0 0;">${testName}</p>
                </div>
                <button onclick="document.getElementById('data-driven-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#6b7280;">&times;</button>
            </div>
            <div style="padding:1.5rem;">

                <!-- Upload Section -->
                <div style="margin-bottom:1.5rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                        <label style="font-weight:600;font-size:0.9rem;">Upload Dataset File</label>
                        <button onclick="apiClient.getDataDrivenTemplate(${testId})" class="btn btn-sm" style="font-size:0.8rem;">
                            &#11015; Download Template CSV
                        </button>
                    </div>
                    <div id="dd-drop-zone" style="border:2px dashed #d1d5db;border-radius:0.5rem;padding:2rem;text-align:center;cursor:pointer;transition:border-color 0.2s;"
                        onclick="document.getElementById('dd-file-input').click()"
                        ondragover="event.preventDefault();this.style.borderColor='#3b82f6';"
                        ondragleave="this.style.borderColor='#d1d5db';"
                        ondrop="event.preventDefault();this.style.borderColor='#d1d5db';app._ddHandleFile(event.dataTransfer.files[0]);">
                        <div style="font-size:2rem;margin-bottom:0.5rem;">&#128194;</div>
                        <div style="color:#6b7280;font-size:0.9rem;">Drop CSV or Excel file here, or click to browse</div>
                        <div style="color:#9ca3af;font-size:0.75rem;margin-top:0.25rem;">Supports .csv and .xlsx</div>
                    </div>
                    <input type="file" id="dd-file-input" accept=".csv,.xlsx,.xls" style="display:none;"
                        onchange="app._ddHandleFile(this.files[0])">
                </div>

                <!-- Column Format Help -->
                <details style="margin-bottom:1.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.75rem;">
                    <summary style="cursor:pointer;font-weight:600;font-size:0.85rem;color:#374151;">&#128203; Column Format Reference</summary>
                    <div style="margin-top:0.75rem;font-size:0.82rem;color:#4b5563;line-height:1.7;">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr style="background:#e5e7eb;"><th style="padding:4px 8px;text-align:left;">Column</th><th style="padding:4px 8px;text-align:left;">Meaning</th><th style="padding:4px 8px;text-align:left;">Example</th></tr></thead>
                            <tbody>
                                <tr><td style="padding:4px 8px;font-family:monospace;">var.&lt;name&gt;</td><td style="padding:4px 8px;">Substitutes <code>{{name}}</code> in body/URL/headers</td><td style="padding:4px 8px;font-family:monospace;">var.userId</td></tr>
                                <tr style="background:#f9fafb;"><td style="padding:4px 8px;font-family:monospace;">expected_status</td><td style="padding:4px 8px;">Expected HTTP status for this row</td><td style="padding:4px 8px;font-family:monospace;">200</td></tr>
                                <tr><td style="padding:4px 8px;font-family:monospace;">assert.body.&lt;path&gt;</td><td style="padding:4px 8px;">Assert body field equals value</td><td style="padding:4px 8px;font-family:monospace;">assert.body.data.id</td></tr>
                                <tr style="background:#f9fafb;"><td style="padding:4px 8px;font-family:monospace;">assert.body.&lt;path&gt;:&lt;op&gt;</td><td style="padding:4px 8px;">Assert with explicit operator</td><td style="padding:4px 8px;font-family:monospace;">assert.body.name:contains</td></tr>
                                <tr><td style="padding:4px 8px;font-family:monospace;">assert.header.&lt;name&gt;</td><td style="padding:4px 8px;">Assert response header contains value</td><td style="padding:4px 8px;font-family:monospace;">assert.header.content-type</td></tr>
                            </tbody>
                        </table>
                        <div style="margin-top:0.5rem;color:#6b7280;">Operators: equals, not_equals, contains, not_contains, starts_with, ends_with, greater_than, less_than, exists, is_null, is_not_null, matches_regex</div>
                    </div>
                </details>

                <!-- Preview Section -->
                <div id="dd-preview" style="display:none;margin-bottom:1.5rem;">
                    <div style="font-weight:600;font-size:0.9rem;margin-bottom:0.5rem;">Preview <span id="dd-preview-count" style="font-weight:400;color:#6b7280;"></span></div>
                    <div id="dd-preview-table" style="overflow-x:auto;font-size:0.8rem;max-height:200px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:0.5rem;"></div>
                </div>

                <!-- Run Button -->
                <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1.5rem;">
                    <button id="dd-run-btn" onclick="app.runDataDrivenTest(${testId})" class="btn btn-primary" disabled style="opacity:0.5;">
                        &#9654; Run All Rows
                    </button>
                    <span id="dd-status-text" style="font-size:0.85rem;color:#6b7280;"></span>
                </div>

                <!-- Results Section -->
                <div id="dd-results" style="display:none;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                        <div style="font-weight:600;font-size:0.9rem;">Results</div>
                        <div id="dd-summary-badge"></div>
                    </div>
                    <div id="dd-results-table" style="overflow-x:auto;"></div>
                </div>

            </div>
        </div>
    </div>`;
    },

    /**
     * Show modal
     */
    showModal(title, content, actions) {
        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = `
            <div class="modal-backdrop" onclick="this.remove()">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="icon-btn" onclick="document.getElementById('modal-container').innerHTML = ''">
                            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${actions ? `
                        <div class="modal-footer">
                            ${actions}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
};
