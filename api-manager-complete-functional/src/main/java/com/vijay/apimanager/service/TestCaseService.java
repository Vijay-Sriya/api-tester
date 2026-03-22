package com.vijay.apimanager.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vijay.apimanager.model.*;
import com.vijay.apimanager.repository.*;
import org.apache.hc.client5.http.classic.methods.*;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.http.client.methods.HttpEntityEnclosingRequestBase;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TestCaseService {
    
    @Autowired
    private TestCaseRepository testCaseRepository;
    
    @Autowired
    private TestResultRepository testResultRepository;

    @Autowired
    private SecretRepository secretRepository;

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private VariableSubstitutionService variableSubstitutionService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CloseableHttpClient defaultHttpClient = HttpClients.createDefault();
    
    public List<TestCase> findByWorkspaceId(Long workspaceId) {
        return testCaseRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);
    }
    
    public Optional<TestCase> findById(Long id) {
        return testCaseRepository.findById(id);
    }
    
    public TestCase create(TestCase testCase) {
        return testCaseRepository.save(testCase);
    }
    
    public TestCase update(Long id, TestCase updates) {
        TestCase existing = testCaseRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Test case not found: " + id));

        // Patch only the fields the edit modal sends
        if (updates.getName() != null)           existing.setName(updates.getName());
        if (updates.getDescription() != null)    existing.setDescription(updates.getDescription());
        if (updates.getMethod() != null)         existing.setMethod(updates.getMethod());
        if (updates.getEndpoint() != null)       existing.setEndpoint(updates.getEndpoint());
        if (updates.getHeaders() != null)        existing.setHeaders(updates.getHeaders());
        if (updates.getBody() != null)           existing.setBody(updates.getBody());
        if (updates.getExpectedStatus() != null) existing.setExpectedStatus(updates.getExpectedStatus());
        if (updates.getAssertions() != null)     existing.setAssertions(updates.getAssertions());
        if (updates.getBaseUrl() != null)        existing.setBaseUrl(updates.getBaseUrl());
        if (updates.getPathParams() != null)     existing.setPathParams(updates.getPathParams());
        existing.setCertId(updates.getCertId()); // null is valid (removes cert binding)

        return testCaseRepository.save(existing);
    }
    
    public void delete(Long id) {
        testCaseRepository.deleteById(id);
    }
    
    /**
     * Execute a single test case
     */
    public TestResult executeTestCase(Long id) throws Exception {
        TestCase testCase = testCaseRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Test case not found"));
        
        long startTime = System.currentTimeMillis();
        
        try {
            // Execute HTTP request
            HttpResponse response = executeHttpRequest(testCase);
            
            // Run assertions
            List<AssertionResult> assertionResults = runAssertions(testCase, response);
            
            // Calculate overall status
            boolean allPassed = assertionResults.stream().allMatch(AssertionResult::isPassed);
            
            // Create result
            TestResult result = new TestResult();
            result.setTestCaseId(id);
            result.setStatus(allPassed ? "passed" : "failed");
            result.setStatusCode(response.statusCode);
            result.setResponseTime((System.currentTimeMillis() - startTime) + "ms");
            result.setResponse(response.body);
            result.setAssertions(objectMapper.writeValueAsString(assertionResults));
            
            // Update test case
            testCase.setLastRunStatus(result.getStatus());
            testCase.setLastRunAt(LocalDateTime.now());
            String responseTime = result.getResponseTime();
            if (responseTime != null) {
                testCase.setLastRunDuration(Long.parseLong(responseTime.replace("ms", "")));
            }
            testCaseRepository.save(testCase);
            
            return testResultRepository.save(result);
            
        } catch (Exception e) {
            // Create error result
            TestResult result = new TestResult();
            result.setTestCaseId(id);
            result.setStatus("failed");
            result.setError(e.getMessage());
            result.setResponseTime((System.currentTimeMillis() - startTime) + "ms");
            
            testCase.setLastRunStatus("failed");
            testCase.setLastRunAt(LocalDateTime.now());
            testCaseRepository.save(testCase);
            
            return testResultRepository.save(result);
        }
    }
    
    /**
     * Execute all test cases in a workspace
     */
    public List<TestResult> executeAll(Long workspaceId) {
        List<TestCase> testCases = findByWorkspaceId(workspaceId);
        
        return testCases.stream()
            .map(testCase -> {
                try {
                    return executeTestCase(testCase.getId());
                } catch (Exception e) {
                    TestResult errorResult = new TestResult();
                    errorResult.setTestCaseId(testCase.getId());
                    errorResult.setStatus("failed");
                    errorResult.setError(e.getMessage());
                    return errorResult;
                }
            })
            .collect(Collectors.toList());
    }
    
    /**
     * Execute one row from a data-driven test run.
     */
    public Map<String, Object> runRow(
            TestCase testCase,
            Map<String, String> extraVars,
            Integer overrideExpectedStatus,
            List<Map<String, Object>> rowAssertions) {

        long startTime = System.currentTimeMillis();
        try {
            HttpResponse response = executeHttpRequestWithVars(testCase, extraVars);
            int expectedStatus = overrideExpectedStatus != null ? overrideExpectedStatus
                    : (testCase.getExpectedStatus() != null ? testCase.getExpectedStatus() : 200);

            // Merge base test case assertions + row assertions
            List<Map<String, Object>> allAssertions = new ArrayList<>();
            if (testCase.getAssertions() != null && !testCase.getAssertions().isBlank()) {
                try {
                    allAssertions.addAll(objectMapper.readValue(testCase.getAssertions(), List.class));
                } catch (Exception ignored) {}
            }
            if (rowAssertions != null) allAssertions.addAll(rowAssertions);

            List<AssertionResult> assertionResults = runAssertionList(response, expectedStatus, allAssertions);
            boolean allPassed = assertionResults.stream().allMatch(AssertionResult::isPassed);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("actualStatus", response.statusCode);
            result.put("expectedStatus", expectedStatus);
            result.put("responseTime", (System.currentTimeMillis() - startTime) + "ms");
            result.put("passed", allPassed);
            result.put("assertions", assertionResults);
            result.put("error", null);
            return result;
        } catch (Exception e) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("actualStatus", 0);
            result.put("expectedStatus", overrideExpectedStatus != null ? overrideExpectedStatus
                    : (testCase.getExpectedStatus() != null ? testCase.getExpectedStatus() : 200));
            result.put("responseTime", (System.currentTimeMillis() - startTime) + "ms");
            result.put("passed", false);
            result.put("assertions", List.of());
            result.put("error", e.getMessage());
            return result;
        }
    }

    /**
     * Execute HTTP request
     */
    private HttpResponse executeHttpRequest(TestCase testCase) throws IOException, ParseException {
        CloseableHttpClient httpClient;
        if (testCase.getCertId() != null) {
            httpClient = secretRepository.findById(testCase.getCertId())
                .map(certificateService::buildApacheClient)
                .orElse(defaultHttpClient);
        } else {
            httpClient = defaultHttpClient;
        }

        // Apply environment variable substitution to all request fields
        Long wsId = testCase.getWorkspaceId();
        Map<String, Object> substituted = variableSubstitutionService.substituteInTestCase(
                testCase.getEndpoint(), testCase.getHeaders(),
                testCase.getParams(),   testCase.getBody(),
                testCase.getBaseUrl(),  wsId);

        // Build a lightweight copy with substituted values so we don't mutate the entity
        TestCase resolved = new TestCase();
        resolved.setMethod(testCase.getMethod());
        resolved.setEndpoint((String) substituted.get("endpoint"));
        resolved.setBaseUrl((String)   substituted.get("baseUrl"));
        resolved.setHeaders((String)   substituted.get("headers"));
        resolved.setBody((String)      substituted.get("body"));
        resolved.setPathParams(testCase.getPathParams());

        HttpUriRequestBase request = createHttpRequest(resolved);

        // Add headers
        if (resolved.getHeaders() != null && !resolved.getHeaders().isEmpty()) {
            try {
                Map<String, String> headers = objectMapper.readValue(resolved.getHeaders(), Map.class);
                headers.forEach(request::setHeader);
            } catch (Exception ignored) {}
        }

        // Add body for POST/PUT/PATCH (only when body is non-null)
        String bodyContent = resolved.getBody() != null && !resolved.getBody().isBlank()
                ? resolved.getBody() : null;
        if (bodyContent != null) {
            if (request instanceof HttpPost)  ((HttpPost)  request).setEntity(new StringEntity(bodyContent));
            else if (request instanceof HttpPut)   ((HttpPut)   request).setEntity(new StringEntity(bodyContent));
            else if (request instanceof HttpPatch) ((HttpPatch) request).setEntity(new StringEntity(bodyContent));
        }

        // Execute request
        try (CloseableHttpResponse response = httpClient.execute(request)) {
            var entity = response.getEntity();
            String body = entity != null ? EntityUtils.toString(entity) : "";
            int statusCode = response.getCode();

            // Collect response headers (lower-cased names for case-insensitive lookup)
            Map<String, String> responseHeaders = new LinkedHashMap<>();
            for (org.apache.hc.core5.http.Header h : response.getHeaders()) {
                responseHeaders.put(h.getName().toLowerCase(), h.getValue());
            }

            return new HttpResponse(statusCode, body, responseHeaders);
        }
    }
    
    /**
     * Execute HTTP request with extra variables (used by data-driven testing)
     */
    private HttpResponse executeHttpRequestWithVars(TestCase testCase, Map<String, String> extraVars)
            throws IOException, ParseException {
        CloseableHttpClient httpClient;
        if (testCase.getCertId() != null) {
            httpClient = secretRepository.findById(testCase.getCertId())
                    .map(certificateService::buildApacheClient)
                    .orElse(defaultHttpClient);
        } else {
            httpClient = defaultHttpClient;
        }

        Long wsId = testCase.getWorkspaceId();
        Map<String, Object> substituted = variableSubstitutionService.substituteInTestCase(
                testCase.getEndpoint(), testCase.getHeaders(),
                testCase.getParams(), testCase.getBody(),
                testCase.getBaseUrl(), wsId, extraVars);

        TestCase resolved = new TestCase();
        resolved.setMethod(testCase.getMethod());
        resolved.setEndpoint((String) substituted.get("endpoint"));
        resolved.setBaseUrl((String)   substituted.get("baseUrl"));
        resolved.setHeaders((String)   substituted.get("headers"));
        resolved.setBody((String)      substituted.get("body"));
        resolved.setPathParams(testCase.getPathParams());

        HttpUriRequestBase request = createHttpRequest(resolved);

        if (resolved.getHeaders() != null && !resolved.getHeaders().isEmpty()) {
            try {
                Map<String, String> headers = objectMapper.readValue(resolved.getHeaders(), Map.class);
                headers.forEach(request::setHeader);
            } catch (Exception ignored) {}
        }

        String bodyContent = resolved.getBody() != null && !resolved.getBody().isBlank()
                ? resolved.getBody() : null;
        if (bodyContent != null) {
            if (request instanceof HttpPost)       ((HttpPost)  request).setEntity(new StringEntity(bodyContent));
            else if (request instanceof HttpPut)   ((HttpPut)   request).setEntity(new StringEntity(bodyContent));
            else if (request instanceof HttpPatch) ((HttpPatch) request).setEntity(new StringEntity(bodyContent));
        }

        try (CloseableHttpResponse response = httpClient.execute(request)) {
            var entity = response.getEntity();
            String body = entity != null ? EntityUtils.toString(entity) : "";
            int statusCode = response.getCode();
            Map<String, String> responseHeaders = new LinkedHashMap<>();
            for (org.apache.hc.core5.http.Header h : response.getHeaders()) {
                responseHeaders.put(h.getName().toLowerCase(), h.getValue());
            }
            return new HttpResponse(statusCode, body, responseHeaders);
        }
    }

    /**
     * Create HTTP request based on method
     */
    private HttpUriRequestBase createHttpRequest(TestCase testCase) {
        String endpoint = testCase.getEndpoint() != null ? testCase.getEndpoint() : "";
        String base = testCase.getBaseUrl() != null ? testCase.getBaseUrl().replaceAll("/+$", "") : "";
        String url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
            ? endpoint
            : base + endpoint;

        // Substitute path parameters: replace {paramName} with stored values
        if (testCase.getPathParams() != null && !testCase.getPathParams().isBlank()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> pathParams = objectMapper.readValue(testCase.getPathParams(), Map.class);
                for (Map.Entry<String, Object> entry : pathParams.entrySet()) {
                    String value = entry.getValue() != null ? entry.getValue().toString() : "";
                    url = url.replace("{" + entry.getKey() + "}", value);
                }
            } catch (Exception ignored) {}
        }

        // Detect unresolved {{envVar}} — substitution ran but variable was not in active environment
        java.util.regex.Matcher unresolvedEnv = java.util.regex.Pattern.compile("\\{\\{([^}]+)\\}\\}").matcher(url);
        if (unresolvedEnv.find()) {
            throw new RuntimeException(
                "Environment variable '{{" + unresolvedEnv.group(1) + "}}' is not defined. " +
                "Add it to your active environment or check that an environment is activated for this workspace."
            );
        }

        // Detect unresolved {pathParam} tokens (single braces only)
        java.util.regex.Matcher unresolvedParam = java.util.regex.Pattern.compile("(?<!\\{)\\{([^{}]+)\\}(?!\\})").matcher(url);
        if (unresolvedParam.find()) {
            throw new RuntimeException(
                "Path parameter '{" + unresolvedParam.group(1) + "}' has no value. " +
                "Edit the test case and fill in the path parameter values."
            );
        }

        return switch (testCase.getMethod().toUpperCase()) {
            case "GET" -> new HttpGet(url);
            case "POST" -> new HttpPost(url);
            case "PUT" -> new HttpPut(url);
            case "DELETE" -> new HttpDelete(url);
            case "PATCH" -> new HttpPatch(url);
            case "HEAD" -> new HttpHead(url);
            case "OPTIONS" -> new HttpOptions(url);
            default -> new HttpGet(url);
        };
    }
    
    /**
     * Run assertions on response (delegates to runAssertionList)
     */
    private List<AssertionResult> runAssertions(TestCase testCase, HttpResponse response) {
        int expectedStatus = testCase.getExpectedStatus() != null ? testCase.getExpectedStatus() : 200;
        List<Map<String, Object>> assertions = new ArrayList<>();
        if (testCase.getAssertions() != null && !testCase.getAssertions().isBlank()) {
            try { assertions = objectMapper.readValue(testCase.getAssertions(), List.class); } catch (Exception ignored) {}
        }
        return runAssertionList(response, expectedStatus, assertions);
    }

    /**
     * Core assertion runner used by both runAssertions and runRow
     */
    private List<AssertionResult> runAssertionList(
            HttpResponse response, int expectedStatus, List<Map<String, Object>> assertions) {
        List<AssertionResult> results = new ArrayList<>();

        // Status check
        AssertionResult statusResult = new AssertionResult();
        statusResult.setName("Status code");
        boolean statusMatch = response.statusCode == expectedStatus;
        statusResult.setPassed(statusMatch);
        statusResult.setDetail("Expected " + expectedStatus + ", got " + response.statusCode);
        results.add(statusResult);

        if (assertions.isEmpty()) return results;

        Object parsedBody = null;
        try { parsedBody = objectMapper.readValue(response.body, Object.class); } catch (Exception ignored) {}

        for (Map<String, Object> assertion : assertions) {
            String field    = (String) assertion.get("field");
            String operator = (String) assertion.get("operator");
            String expected = assertion.get("value") != null ? assertion.get("value").toString() : "";

            if (field == null || operator == null) continue;

            AssertionResult ar = new AssertionResult();
            ar.setName(field + " " + operator.replace("_", " ") + (expected.isEmpty() ? "" : " " + expected));

            Object actual;
            if (field.startsWith("header.")) {
                String headerName = field.substring("header.".length()).toLowerCase();
                actual = response.headers.get(headerName);
            } else {
                actual = getByDotPath(parsedBody, field);
            }

            boolean passed = evalAssertion(actual, operator, expected);
            ar.setPassed(passed);
            ar.setDetail(passed ? "✓ actual: " + actual : "✗ actual: " + actual + ", expected: " + expected);
            results.add(ar);
        }
        return results;
    }
    
    /**
     * Inner class for HTTP response
     */
    private static class HttpResponse {
        int statusCode;
        String body;
        Map<String, String> headers; // lower-cased header names

        HttpResponse(int statusCode, String body, Map<String, String> headers) {
            this.statusCode = statusCode;
            this.body = body;
            this.headers = headers != null ? headers : new LinkedHashMap<>();
        }
    }
    
    /** Resolve dot-notation path (e.g. "data.user.name", "items[0].id") on a parsed JSON object */
    @SuppressWarnings("unchecked")
    private Object getByDotPath(Object root, String path) {
        if (root == null || path == null || path.isEmpty()) return null;
        Object cur = root;
        for (String key : path.split("\\.")) {
            if (cur == null) return null;
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.+)\\[(\\d+)]$").matcher(key);
            if (m.matches()) {
                if (cur instanceof Map) cur = ((Map<?, ?>) cur).get(m.group(1));
                if (cur instanceof List) cur = ((List<?>) cur).get(Integer.parseInt(m.group(2)));
                else return null;
            } else {
                if (cur instanceof Map) cur = ((Map<?, ?>) cur).get(key);
                else return null;
            }
        }
        return cur;
    }

    /** Evaluate assertion — mirrors the JS _evalAssertion logic */
    private boolean evalAssertion(Object actual, String operator, String expected) {
        String actualStr = actual != null ? actual.toString() : "";
        double actualNum = 0; boolean isNum = false;
        try { actualNum = Double.parseDouble(actualStr); isNum = true; } catch (Exception ignored) {}
        double expNum = 0;
        try { expNum = Double.parseDouble(expected); } catch (Exception ignored) {}

        return switch (operator) {
            case "equals"                -> actualStr.equals(expected);
            case "not_equals"            -> !actualStr.equals(expected);
            case "contains"              -> actualStr.contains(expected);
            case "not_contains"          -> !actualStr.contains(expected);
            case "starts_with"           -> actualStr.startsWith(expected);
            case "ends_with"             -> actualStr.endsWith(expected);
            case "matches_regex"         -> { try { yield actualStr.matches(expected); } catch (Exception e) { yield false; } }
            case "greater_than"          -> isNum && actualNum > expNum;
            case "less_than"             -> isNum && actualNum < expNum;
            case "greater_than_or_equal" -> isNum && actualNum >= expNum;
            case "less_than_or_equal"    -> isNum && actualNum <= expNum;
            case "is_number"             -> isNum;
            case "is_integer"            -> isNum && actualNum == Math.floor(actualNum);
            case "is_double"             -> isNum && actualNum != Math.floor(actualNum);
            case "is_string"             -> actual instanceof String;
            case "is_boolean"            -> actual instanceof Boolean;
            case "is_array"              -> actual instanceof List;
            case "is_object"             -> actual instanceof Map;
            case "is_null"               -> actual == null;
            case "is_not_null"           -> actual != null;
            case "length_equals"         -> getLength(actual) == (int) expNum;
            case "length_greater_than"   -> getLength(actual) > (int) expNum;
            case "length_less_than"      -> getLength(actual) < (int) expNum;
            case "exists"                -> actual != null;
            case "not_exists"            -> actual == null;
            case "is_empty"              -> actual == null || actualStr.isEmpty() || (actual instanceof List && ((List<?>) actual).isEmpty()) || (actual instanceof Map && ((Map<?, ?>) actual).isEmpty());
            case "is_not_empty"          -> actual != null && !actualStr.isEmpty() && !(actual instanceof List && ((List<?>) actual).isEmpty()) && !(actual instanceof Map && ((Map<?, ?>) actual).isEmpty());
            default                      -> false;
        };
    }

    private int getLength(Object val) {
        if (val instanceof String) return ((String) val).length();
        if (val instanceof List) return ((List<?>) val).size();
        if (val instanceof Map) return ((Map<?, ?>) val).size();
        return val != null ? val.toString().length() : 0;
    }

    /**
     * Inner class for assertion results
     */
    private static class AssertionResult {
        private String name;
        private boolean passed;
        private String detail;
        
        // Getters and setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public boolean isPassed() { return passed; }
        public void setPassed(boolean passed) { this.passed = passed; }
        
        public String getDetail() { return detail; }
        public void setDetail(String detail) { this.detail = detail; }
    }
}
