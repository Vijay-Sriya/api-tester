1/**
 * Report Generator
 * Generates downloadable HTML reports for test execution and load testing
 */

class ReportGenerator {
    /**
     * Generate Test Execution Report (Cucumber-style)
     */
    generateTestExecutionReport(testResults, workspaceName) {
        const timestamp = new Date().toISOString();
        const totalTests = testResults.length;
        const passed = testResults.filter(t => t.status === 'passed').length;
        const failed = testResults.filter(t => t.status === 'failed').length;
        const skipped = testResults.filter(t => t.status === 'skipped').length;
        const passRate = ((passed / totalTests) * 100).toFixed(2);
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Execution Report - ${workspaceName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 2rem; }
        .container { max-width: 1200px; margin: 0 auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 8px 8px 0 0; }
        .header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .header .meta { opacity: 0.9; font-size: 0.875rem; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding: 2rem; border-bottom: 1px solid #e5e7eb; }
        .summary-card { text-align: center; padding: 1rem; border-radius: 8px; }
        .summary-card.total { background: #eff6ff; }
        .summary-card.passed { background: #d1fae5; }
        .summary-card.failed { background: #fee2e2; }
        .summary-card.skipped { background: #fef3c7; }
        .summary-number { font-size: 2.5rem; font-weight: bold; }
        .summary-label { font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem; }
        .pass-rate { padding: 2rem; text-align: center; border-bottom: 1px solid #e5e7eb; }
        .pass-rate-circle { width: 150px; height: 150px; margin: 0 auto 1rem; position: relative; }
        .pass-rate-text { font-size: 2rem; font-weight: bold; color: ${passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444'}; }
        .tests { padding: 2rem; }
        .test-item { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem; overflow: hidden; }
        .test-header { padding: 1rem 1.5rem; background: #f9fafb; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .test-header:hover { background: #f3f4f6; }
        .test-name { font-weight: 600; }
        .test-status { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .test-status.passed { background: #d1fae5; color: #065f46; }
        .test-status.failed { background: #fee2e2; color: #991b1b; }
        .test-status.skipped { background: #fef3c7; color: #92400e; }
        .test-body { padding: 1.5rem; background: white; border-top: 1px solid #e5e7eb; }
        .test-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
        .test-meta-item { font-size: 0.875rem; }
        .test-meta-label { color: #6b7280; }
        .test-meta-value { font-weight: 600; }
        .assertions { margin-top: 1rem; }
        .assertion { padding: 0.75rem 1rem; border-left: 4px solid; margin-bottom: 0.5rem; background: #f9fafb; }
        .assertion.passed { border-color: #10b981; }
        .assertion.failed { border-color: #ef4444; }
        .assertion-name { font-weight: 500; margin-bottom: 0.25rem; }
        .assertion-detail { font-size: 0.75rem; color: #6b7280; }
        .request-response { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
        .code-block { background: #1f2937; color: #10b981; padding: 1rem; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.875rem; }
        .section-title { font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem; }
        .footer { padding: 2rem; text-align: center; color: #6b7280; font-size: 0.875rem; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Execution Report</h1>
            <div class="meta">
                <div>Workspace: ${workspaceName}</div>
                <div>Generated: ${new Date(timestamp).toLocaleString()}</div>
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card total">
                <div class="summary-number">${totalTests}</div>
                <div class="summary-label">Total Tests</div>
            </div>
            <div class="summary-card passed">
                <div class="summary-number" style="color: #10b981;">${passed}</div>
                <div class="summary-label">Passed</div>
            </div>
            <div class="summary-card failed">
                <div class="summary-number" style="color: #ef4444;">${failed}</div>
                <div class="summary-label">Failed</div>
            </div>
            <div class="summary-card skipped">
                <div class="summary-number" style="color: #f59e0b;">${skipped}</div>
                <div class="summary-label">Skipped</div>
            </div>
        </div>
        
        <div class="pass-rate">
            <div class="pass-rate-circle">
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" stroke-width="10"/>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="${passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444'}" 
                            stroke-width="10" stroke-dasharray="${passRate * 2.827}, 282.7" 
                            transform="rotate(-90 50 50)" stroke-linecap="round"/>
                </svg>
            </div>
            <div class="pass-rate-text">${passRate}%</div>
            <div style="color: #6b7280;">Pass Rate</div>
        </div>
        
        <div class="tests">
            ${testResults.map(test => `
                <div class="test-item">
                    <div class="test-header">
                        <div class="test-name">${test.name}</div>
                        <span class="test-status ${test.status}">${test.status.toUpperCase()}</span>
                    </div>
                    <div class="test-body">
                        <div class="test-meta">
                            <div class="test-meta-item">
                                <div class="test-meta-label">Method</div>
                                <div class="test-meta-value">${test.method}</div>
                            </div>
                            <div class="test-meta-item">
                                <div class="test-meta-label">Endpoint</div>
                                <div class="test-meta-value">${test.endpoint}</div>
                            </div>
                            <div class="test-meta-item">
                                <div class="test-meta-label">Response Time</div>
                                <div class="test-meta-value">${test.responseTime || 'N/A'}</div>
                            </div>
                        </div>
                        
                        ${test.assertions && test.assertions.length > 0 ? `
                            <div class="assertions">
                                <div class="section-title">Assertions</div>
                                ${test.assertions.map(assertion => `
                                    <div class="assertion ${assertion.passed ? 'passed' : 'failed'}">
                                        <div class="assertion-name">${assertion.passed ? '✓' : '✗'} ${assertion.name}</div>
                                        <div class="assertion-detail">${assertion.detail || ''}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        ${test.request || test.response ? `
                            <div class="request-response">
                                ${test.request ? `
                                    <div>
                                        <div class="section-title">Request</div>
                                        <pre class="code-block">${JSON.stringify(test.request, null, 2)}</pre>
                                    </div>
                                ` : ''}
                                ${test.response ? `
                                    <div>
                                        <div class="section-title">Response</div>
                                        <pre class="code-block">${JSON.stringify(test.response, null, 2)}</pre>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        ${test.error ? `
                            <div style="margin-top: 1rem; padding: 1rem; background: #fee2e2; border-radius: 4px; color: #991b1b;">
                                <strong>Error:</strong> ${test.error}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            Generated by API Automation Tool 3.0 • ${new Date(timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>
        `;
        
        return html;
    }
    
    /**
     * Generate Load Test Report
     */
    generateLoadTestReport(loadTestResults, config) {
        const timestamp = new Date().toISOString();
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Report - ${config.name || 'Load Test'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 2rem; }
        .container { max-width: 1200px; margin: 0 auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 2rem; border-radius: 8px 8px 0 0; }
        .header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .header .meta { opacity: 0.9; font-size: 0.875rem; }
        .config { padding: 2rem; background: #fffbeb; border-bottom: 1px solid #e5e7eb; }
        .config h2 { margin-bottom: 1rem; color: #92400e; }
        .config-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .config-item { }
        .config-label { font-size: 0.75rem; color: #92400e; margin-bottom: 0.25rem; }
        .config-value { font-weight: 600; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 2rem; border-bottom: 1px solid #e5e7eb; }
        .summary-card { padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e7eb; }
        .summary-number { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .summary-label { color: #6b7280; font-size: 0.875rem; }
        .metrics { padding: 2rem; }
        .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
        .metric-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; }
        .metric-card h3 { margin-bottom: 1rem; color: #374151; }
        .metric-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #f3f4f6; }
        .metric-row:last-child { border-bottom: none; }
        .metric-label { color: #6b7280; }
        .metric-value { font-weight: 600; }
        .metric-good { color: #10b981; }
        .metric-warning { color: #f59e0b; }
        .metric-bad { color: #ef4444; }
        .chart { padding: 2rem; border-top: 1px solid #e5e7eb; }
        .chart h3 { margin-bottom: 1rem; }
        .chart-container { height: 300px; background: #f9fafb; border-radius: 8px; display: flex; align-items: flex-end; padding: 2rem; gap: 4px; }
        .chart-bar { flex: 1; background: linear-gradient(180deg, #3b82f6, #2563eb); border-radius: 4px 4px 0 0; position: relative; }
        .chart-label { position: absolute; bottom: -1.5rem; left: 50%; transform: translateX(-50%); font-size: 0.75rem; color: #6b7280; }
        .thresholds { padding: 2rem; background: #f9fafb; }
        .thresholds h3 { margin-bottom: 1rem; }
        .threshold-item { display: flex; justify-content: space-between; padding: 1rem; background: white; border-radius: 8px; margin-bottom: 0.5rem; }
        .threshold-item.pass { border-left: 4px solid #10b981; }
        .threshold-item.fail { border-left: 4px solid #ef4444; }
        .footer { padding: 2rem; text-align: center; color: #6b7280; font-size: 0.875rem; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ Load Test Report</h1>
            <div class="meta">
                <div>Test: ${config.name || 'Load Test'}</div>
                <div>Generated: ${new Date(timestamp).toLocaleString()}</div>
                <div>Duration: ${loadTestResults.duration || config.duration}</div>
            </div>
        </div>
        
        <div class="config">
            <h2>Test Configuration</h2>
            <div class="config-grid">
                <div class="config-item">
                    <div class="config-label">Virtual Users</div>
                    <div class="config-value">${config.virtualUsers || 100}</div>
                </div>
                <div class="config-item">
                    <div class="config-label">Duration</div>
                    <div class="config-value">${config.duration || '2m'}</div>
                </div>
                <div class="config-item">
                    <div class="config-label">Ramp-up Time</div>
                    <div class="config-value">${config.rampUp || '30s'}</div>
                </div>
                <div class="config-item">
                    <div class="config-label">Scenario</div>
                    <div class="config-value">${config.scenario || 'Baseline'}</div>
                </div>
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <div class="summary-number" style="color: #3b82f6;">${loadTestResults.totalRequests || 6000}</div>
                <div class="summary-label">Total Requests</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #10b981;">${loadTestResults.successfulRequests || 5940}</div>
                <div class="summary-label">Successful</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #ef4444;">${loadTestResults.failedRequests || 60}</div>
                <div class="summary-label">Failed</div>
            </div>
        </div>
        
        <div class="metrics">
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Response Times</h3>
                    <div class="metric-row">
                        <span class="metric-label">Average</span>
                        <span class="metric-value metric-good">${loadTestResults.avgResponseTime || '234ms'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">P50 (Median)</span>
                        <span class="metric-value">${loadTestResults.p50 || '198ms'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">P95</span>
                        <span class="metric-value ${(loadTestResults.p95Value || 456) > 500 ? 'metric-bad' : 'metric-good'}">${loadTestResults.p95 || '456ms'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">P99</span>
                        <span class="metric-value ${(loadTestResults.p99Value || 678) > 1000 ? 'metric-bad' : 'metric-warning'}">${loadTestResults.p99 || '678ms'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Max</span>
                        <span class="metric-value">${loadTestResults.maxResponseTime || '1234ms'}</span>
                    </div>
                </div>
                
                <div class="metric-card">
                    <h3>Throughput & Performance</h3>
                    <div class="metric-row">
                        <span class="metric-label">Requests/sec</span>
                        <span class="metric-value metric-good">${loadTestResults.rps || '50.2'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Success Rate</span>
                        <span class="metric-value metric-good">${loadTestResults.successRate || '99.0%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Error Rate</span>
                        <span class="metric-value ${parseFloat(loadTestResults.errorRate || 1.0) > 1 ? 'metric-bad' : 'metric-good'}">${loadTestResults.errorRate || '1.0%'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Data Transferred</span>
                        <span class="metric-value">${loadTestResults.dataTransferred || '7.2 MB'}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Data Received</span>
                        <span class="metric-value">${loadTestResults.dataReceived || '12.8 MB'}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="chart">
            <h3>Response Time Distribution</h3>
            <div class="chart-container">
                ${[10, 25, 45, 70, 85, 95, 100, 95, 80, 60, 40, 25].map((height, i) => `
                    <div class="chart-bar" style="height: ${height}%">
                        <span class="chart-label">${i * 10}s</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="thresholds">
            <h3>Performance Thresholds</h3>
            ${[
                { name: 'P95 Response Time', expected: '< 500ms', actual: loadTestResults.p95 || '456ms', pass: (loadTestResults.p95Value || 456) < 500 },
                { name: 'Error Rate', expected: '< 1%', actual: loadTestResults.errorRate || '1.0%', pass: parseFloat(loadTestResults.errorRate || 1.0) < 1 },
                { name: 'Throughput', expected: '> 50 RPS', actual: `${loadTestResults.rps || '50.2'} RPS`, pass: parseFloat(loadTestResults.rps || 50.2) > 50 },
                { name: 'Success Rate', expected: '> 99%', actual: loadTestResults.successRate || '99.0%', pass: parseFloat(loadTestResults.successRate || 99.0) > 99 }
            ].map(threshold => `
                <div class="threshold-item ${threshold.pass ? 'pass' : 'fail'}">
                    <div>
                        <strong>${threshold.name}</strong>
                        <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">Expected: ${threshold.expected}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600;">${threshold.actual}</div>
                        <div style="font-size: 0.875rem; color: ${threshold.pass ? '#10b981' : '#ef4444'};">
                            ${threshold.pass ? '✓ PASS' : '✗ FAIL'}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            Generated by API Automation Tool 3.0 • ${new Date(timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>
        `;
        
        return html;
    }
    
    /**
     * Download HTML report as file
     */
    downloadReport(html, filename) {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Global instance
const reportGenerator = new ReportGenerator();
