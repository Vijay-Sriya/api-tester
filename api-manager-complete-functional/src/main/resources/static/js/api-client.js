/**
 * API Client
 * Communicates with Spring Boot backend
 */

const apiClient = {
    baseUrl: '',  // Same origin
    
    /**
     * Helper: Make HTTP request
     */
    async request(url, options = {}) {
        const response = await fetch(this.baseUrl + url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    },
    
    // ==================== WORKSPACE APIs ====================
    
    async getWorkspaces() {
        return this.request('/api/workspaces');
    },
    
    async getWorkspaceData(workspaceId) {
        return this.request(`/api/workspaces/${workspaceId}/data`);
    },
    
    async createWorkspace(data) {
        return this.request('/api/workspaces', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async updateWorkspace(id, data) {
        return this.request(`/api/workspaces/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    async deleteWorkspace(id) {
        const response = await fetch(this.baseUrl + `/api/workspaces/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    },
    
    // ==================== SWAGGER APIs ====================
    
    async getSwaggerFiles(workspaceId) {
        return this.request(`/api/swagger/workspace/${workspaceId}`);
    },
    
    async uploadSwagger(formData) {
        const response = await fetch(this.baseUrl + '/api/swagger/upload', {
            method: 'POST',
            body: formData  // Don't set Content-Type for FormData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        return response.json();
    },
    
    async addSwaggerFromUrl(data) {
        return this.request('/api/swagger/url', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async refreshSwagger(id) {
        return this.request(`/api/swagger/${id}/refresh`, {
            method: 'POST'
        });
    },
    
    async deleteSwagger(id) {
        const response = await fetch(this.baseUrl + `/api/swagger/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    },
    
    // ==================== ENDPOINT APIs ====================
    
    async getEndpoints(workspaceId) {
        return this.request(`/api/endpoints/workspace/${workspaceId}`);
    },
    
    // ==================== TEST CASE APIs ====================
    
    async getTestCases(workspaceId) {
        return this.request(`/api/test-cases/workspace/${workspaceId}`);
    },
    
    async getTestCase(id) {
        return this.request(`/api/test-cases/${id}`);
    },
    
    async createTestCase(data) {
        return this.request('/api/test-cases', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async updateTestCase(id, data) {
        return this.request(`/api/test-cases/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    async deleteTestCase(id) {
        const response = await fetch(this.baseUrl + `/api/test-cases/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    },
    
    async runTestCase(id) {
        return this.request(`/api/test-cases/${id}/run`, {
            method: 'POST'
        });
    },
    
    async runAllTests(workspaceId) {
        return this.request(`/api/test-cases/workspace/${workspaceId}/run-all`, {
            method: 'POST'
        });
    },

    // Generate fake data for endpoint
    async generateFakeData(endpointId) {
        return this.request(`/api/endpoints/${endpointId}/generate-fake-data`);
    },
    
    // ==================== SECRET APIs ====================
    
    async getSecrets(workspaceId) {
        return this.request(`/api/secrets/workspace/${workspaceId}`);
    },


    
    async createSecret(data) {
        return this.request('/api/secrets', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async deleteSecret(id) {
        const response = await fetch(this.baseUrl + `/api/secrets/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    },
    
    // ==================== MOCK SERVER APIs ====================
    
    async getMockServerStatus() {
        return this.request('/api/mock/status');
    },
    
    async startMockServer(config) {
        return this.request('/api/mock/start', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    },
    
    async stopMockServer() {
        return this.request('/api/mock/stop', {
            method: 'POST'
        });
    },
    
    async getMockServerLogs() {
        return this.request('/api/mock/logs');
    },
    
    // ==================== LOAD TEST APIs ====================
    
    async startLoadTest(config) {
        return this.request('/api/load-test/start', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    },

    async getLoadTestStatus(testId) {
        return this.request(`/api/load-test/${testId}/status`);
    },

    async getLoadTestResults(testId) {
        return this.request(`/api/load-test/${testId}/results`);
    },

    async stopLoadTest(testId) {
        return this.request(`/api/load-test/${testId}/stop`, { method: 'POST' });
    },

    async previewFakeData(payload) {
        return this.request('/api/load-test/preview-fake', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    // ==================== TEST SUITES ====================

    async getTestSuites(workspaceId) {
        return this.request(`/api/test-suites/workspace/${workspaceId}`);
    },

    async createTestSuite(data) {
        return this.request('/api/test-suites', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateTestSuite(id, data) {
        return this.request(`/api/test-suites/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async deleteTestSuite(id) {
        const response = await fetch(this.baseUrl + `/api/test-suites/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    },

    async getTestCasesBySuite(suiteId) {
        return this.request(`/api/test-cases/suite/${suiteId}`);
    },

    // Test Suites
    async getTestSuites(workspaceId) {
        return this.request(`/api/test-suites/workspace/${workspaceId}`);
    },

    async createTestSuite(suiteData) {
        return this.request('/api/test-suites', {
            method: 'POST',
            body: JSON.stringify(suiteData)
        });
    },

    // ==================== CERTIFICATES ====================

    async getCertificates(workspaceId) {
        return this.request(`/api/certificates/workspace/${workspaceId}`);
    },

    async saveCertificate(data) {
        return this.request('/api/certificates', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async deleteCertificate(id) {
        const response = await fetch(this.baseUrl + `/api/certificates/${id}`, {
            method: 'DELETE'
        });
        return response.ok;
    },

    // Test Cases
    async saveRequestAsTestCase(testCaseData) {
        return this.request('/api/test-cases/from-request', {
            method: 'POST',
            body: JSON.stringify(testCaseData)
        });
    },

    async getTestCasesBySuite(suiteId) {
        return this.request(`/api/test-cases/suite/${suiteId}`);
    },

    
    async sendQuickRequest({ method, url, headers, body, certId = null, forceProxy = false }) {
        const startTime = Date.now();

        // Parse headers
        let parsedHeaders = {};
        if (headers) {
            try { parsedHeaders = JSON.parse(headers); } catch (e) {}
        }

        // Route external URLs through the backend proxy to avoid CORS
        // Also force proxy when a client cert is selected (browser can't use DB-stored certs)
        const isExternal = url.startsWith('http://') || url.startsWith('https://');
        const isSameOrigin = url.startsWith(window.location.origin) || url.startsWith('/');

        if (forceProxy || (isExternal && !isSameOrigin)) {
            return this.request('/api/proxy', {
                method: 'POST',
                body: JSON.stringify({ method, url, headers: parsedHeaders, body, certId: certId || null })
            });
        }

        try {
            // Same-origin request — send directly
            const options = {
                method: method,
                headers: parsedHeaders
            };

            if (body && method !== 'GET' && method !== 'DELETE') {
                options.body = body;
            }

            const response = await fetch(url, options);
            const responseText = await response.text();
            const responseTime = Date.now() - startTime;
            
            // Try to parse as JSON
            let responseBody;
            try {
                responseBody = JSON.parse(responseText);
            } catch (e) {
                responseBody = responseText;
            }
            
            return {
                status: response.status,
                responseTime: responseTime + 'ms',
                size: new Blob([responseText]).size,
                body: responseBody,
                headers: Object.fromEntries(response.headers.entries())
            };
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            throw {
                status: 0,
                responseTime: responseTime + 'ms',
                error: error.message,
                body: { error: error.message }
            };
        }
    },

    // Environments
    async getEnvironments(workspaceId) {
        return this.request(`/api/environments/workspace/${workspaceId}`);
    },

    async getActiveEnvironment(workspaceId) {
        return this.request(`/api/environments/workspace/${workspaceId}/active`);
    },

    async createEnvironment(envData) {
        return this.request('/api/environments', {
            method: 'POST',
            body: JSON.stringify(envData)
        });
    },

    async activateEnvironment(environmentId) {
        return this.request(`/api/environments/${environmentId}/activate`, {
            method: 'POST'
        });
    },

    async deleteEnvironment(environmentId) {
        const response = await fetch(this.baseUrl + `/api/environments/${environmentId}`, {
            method: 'DELETE'
        });
        return response.ok;
    },

    // Environment Variables
    async getVariables(environmentId) {
        return this.request(`/api/environments/${environmentId}/variables`);
    },

    async saveVariable(environmentId, variableData) {
        return this.request(`/api/environments/${environmentId}/variables`, {
            method: 'POST',
            body: JSON.stringify(variableData)
        });
    },

    async updateVariable(variableId, variableData) {
        return this.request(`/api/environment-variables/${variableId}`, {
            method: 'PUT',
            body: JSON.stringify(variableData)
        });
    },

    async deleteVariable(variableId) {
        const response = await fetch(this.baseUrl + `/api/environment-variables/${variableId}`, {
            method: 'DELETE'
        });
        return response.ok;
    },

    async previewSubstitution(text, workspaceId) {
        return this.request('/api/environments/preview-substitution', {
            method: 'POST',
            body: JSON.stringify({ text, workspaceId })
        });
    },

    // ==================== DATA-DRIVEN TESTING ====================

    async runDataDrivenTest(testCaseId, file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(this.baseUrl + `/api/test-cases/${testCaseId}/data-driven`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(err.error || response.statusText);
        }
        return response.json();
    },

    async getDataDrivenTemplate(testCaseId) {
        const response = await fetch(this.baseUrl + `/api/test-cases/${testCaseId}/data-driven/template`);
        if (!response.ok) throw new Error('Failed to get template');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'test-data-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    },
};
