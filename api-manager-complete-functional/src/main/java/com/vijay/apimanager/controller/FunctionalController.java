package com.vijay.apimanager.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vijay.apimanager.faker.FakeDataGenerator;
import com.vijay.apimanager.model.*;
import com.vijay.apimanager.repository.*;
import com.vijay.apimanager.service.*;
import io.swagger.annotations.ApiImplicitParam;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class FunctionalController {
    
    @Autowired
    private WorkspaceService workspaceService;
    
    @Autowired
    private SwaggerService swaggerService;
    
    @Autowired
    private TestCaseService testCaseService;

    @Autowired
    private TestSuiteRepository testSuiteRepository;

    @Autowired
    private TestCaseRepository testCaseRepository;

    @Autowired
    private SwaggerFileRepository swaggerFileRepository;

    @Autowired
    private EndpointRepository endpointRepository;
    @Autowired
    private SwaggerSchemaParser swaggerSchemaParser;

    @Autowired
    private FakeDataGenerator fakeDataGenerator;

    @Autowired
    private EnvironmentRepository environmentRepository;

    @Autowired
    private EnvironmentVariableRepository environmentVariableRepository;

    @Autowired
    private VariableSubstitutionService variableSubstitutionService;

    @Autowired
    private MockServerService mockServerService;

    @Autowired
    private LoadTestService loadTestService;

    @Autowired
    private SecretRepository secretRepository;

    @Autowired
    private EncryptionService encryptionService;

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private DataDrivenService dataDrivenService;
    
    @GetMapping("/workspaces")
    public ResponseEntity<List<Workspace>> getWorkspaces() {
        return ResponseEntity.ok(workspaceService.findAll());
    }
    
    @GetMapping("/workspaces/{id}")
    public ResponseEntity<Workspace> getWorkspace(@PathVariable Long id) {
        return workspaceService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/workspaces/{id}/data")
    public ResponseEntity<Map<String, Object>> getWorkspaceData(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(workspaceService.getWorkspaceData(id));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    @PostMapping("/workspaces")
    public ResponseEntity<Workspace> createWorkspace(@RequestBody Workspace workspace) {
        Workspace created = workspaceService.create(workspace);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
    
    @PutMapping("/workspaces/{id}")
    public ResponseEntity<Workspace> updateWorkspace(
            @PathVariable Long id,
            @RequestBody Workspace workspace) {
        Workspace updated = workspaceService.update(id, workspace);
        return ResponseEntity.ok(updated);
    }
    
    @DeleteMapping("/workspaces/{id}")
    public ResponseEntity<Void> deleteWorkspace(@PathVariable Long id) {
        workspaceService.delete(id);
        return ResponseEntity.noContent().build();
    }
    
    // ==================== SWAGGER ENDPOINTS ====================
    
    @GetMapping("/swagger/workspace/{workspaceId}")
    public ResponseEntity<List<SwaggerFile>> getSwaggerFiles(@PathVariable Long workspaceId) {
        return ResponseEntity.ok(swaggerService.findByWorkspaceId(workspaceId));
    }
    
    @PostMapping("/swagger/upload")
    public ResponseEntity<SwaggerFile> uploadSwagger(
            @RequestParam("workspaceId") Long workspaceId,
            @RequestParam("file") MultipartFile file) {
        try {
            SwaggerFile swagger = swaggerService.uploadFile(workspaceId, file);
            return ResponseEntity.status(HttpStatus.CREATED).body(swagger);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PostMapping("/swagger/url")
    public ResponseEntity<SwaggerFile> addSwaggerFromUrl(@RequestBody Map<String, Object> request) {
        try {
            Long workspaceId = Long.valueOf(request.get("workspaceId").toString());
            String name = (String) request.get("name");
            String url = (String) request.get("url");
            String source = (String) request.get("source");
            
            SwaggerFile swagger = swaggerService.addFromUrl(workspaceId, name, url, source);
            return ResponseEntity.status(HttpStatus.CREATED).body(swagger);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
    
    @PostMapping("/swagger/{id}/refresh")
    public ResponseEntity<SwaggerFile> refreshSwagger(@PathVariable Long id) {
        try {
            SwaggerFile swagger = swaggerService.refresh(id);
            return ResponseEntity.ok(swagger);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @DeleteMapping("/swagger/{id}")
    public ResponseEntity<Void> deleteSwagger(@PathVariable Long id) {
        swaggerService.delete(id);
        return ResponseEntity.noContent().build();
    }
    
    // ==================== TEST CASE ENDPOINTS ====================
    
    @GetMapping("/test-cases/workspace/{workspaceId}")
    public ResponseEntity<List<TestCase>> getTestCases(@PathVariable Long workspaceId) {
        return ResponseEntity.ok(testCaseService.findByWorkspaceId(workspaceId));
    }
    
    @GetMapping("/test-cases/{id}")
    public ResponseEntity<TestCase> getTestCase(@PathVariable Long id) {
        return testCaseService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/test-cases")
    public ResponseEntity<TestCase> createTestCase(@RequestBody TestCase testCase) {
        TestCase created = testCaseService.create(testCase);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
    
    @PutMapping("/test-cases/{id}")
    public ResponseEntity<TestCase> updateTestCase(
            @PathVariable Long id,
            @RequestBody TestCase testCase) {
        TestCase updated = testCaseService.update(id, testCase);
        return ResponseEntity.ok(updated);
    }
    
    @DeleteMapping("/test-cases/{id}")
    public ResponseEntity<Void> deleteTestCase(@PathVariable Long id) {
        testCaseService.delete(id);
        return ResponseEntity.noContent().build();
    }
    
    @PostMapping("/test-cases/{id}/run")
    public ResponseEntity<TestResult> runTestCase(@PathVariable Long id) {
        try {
            TestResult result = testCaseService.executeTestCase(id);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PostMapping("/test-cases/workspace/{workspaceId}/run-all")
    public ResponseEntity<List<TestResult>> runAllTests(@PathVariable Long workspaceId) {
        try {
            List<TestResult> results = testCaseService.executeAll(workspaceId);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/endpoints/{endpointId}/generate-fake-data")
    public ResponseEntity<Map<String, Object>> generateFakeDataForEndpoint(@PathVariable Long endpointId) {
        try {
            // Get endpoint
            Endpoint endpoint = endpointRepository.findById(endpointId)
                    .orElseThrow(() -> new RuntimeException("Endpoint not found"));

            // Get swagger file
            SwaggerFile swaggerFile = swaggerFileRepository.findById(endpoint.getSwaggerFileId())
                    .orElseThrow(() -> new RuntimeException("Swagger file not found"));

            // Parse schema
            SwaggerSchemaParser.EndpointSchema schema = swaggerSchemaParser.parseEndpointSchema(
                    swaggerFile.getFilePath(),
                    endpoint.getPath(),
                    endpoint.getMethod()
            );

            // Generate fake data
            Map<String, Object> fakeData = fakeDataGenerator.generateRequestFromSchema(schema);

            return ResponseEntity.ok(fakeData);

        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/test-suites/workspace/{workspaceId}")
    public ResponseEntity<List<TestSuite>> getTestSuites(@PathVariable Long workspaceId) {
        try {
            List<TestSuite> suites = testSuiteRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);
            return ResponseEntity.ok(suites);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(new ArrayList<>());
        }
    }

    // ==================== CERTIFICATES ====================

    @GetMapping("/certificates/workspace/{workspaceId}")
    public ResponseEntity<List<Secret>> getCertificates(@PathVariable Long workspaceId) {
        try {
            List<Secret> certs = secretRepository.findByWorkspaceIdAndType(workspaceId, "certificate");
            // Never expose encryptedValue to frontend
            certs.forEach(c -> c.setEncryptedValue(null));
            return ResponseEntity.ok(certs);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(new ArrayList<>());
        }
    }

    @PostMapping("/certificates")
    public ResponseEntity<Secret> saveCertificate(@RequestBody Map<String, Object> payload) {
        try {
            Secret cert = new Secret();
            cert.setWorkspaceId(Long.parseLong(payload.get("workspaceId").toString()));
            cert.setName(payload.get("name").toString());
            cert.setType("certificate");
            cert.setEnvironment(payload.getOrDefault("environment", "development").toString());
            cert.setCertType(payload.getOrDefault("certType", "PKCS12").toString());
            cert.setPassphrase(payload.containsKey("passphrase") ? payload.get("passphrase") != null ? payload.get("passphrase").toString() : null : null);
            cert.setEncryptedValue(encryptionService.encrypt(payload.get("content").toString())); // AES-GCM encrypted
            if (payload.containsKey("expiresAt") && payload.get("expiresAt") != null
                    && !payload.get("expiresAt").toString().isEmpty()) {
                cert.setExpiresAt(LocalDate.parse(payload.get("expiresAt").toString()));
            }
            Secret saved = secretRepository.save(cert);
            saved.setEncryptedValue(null); // don't echo back
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @DeleteMapping("/certificates/{id}")
    public ResponseEntity<Void> deleteCertificate(@PathVariable Long id) {
        try {
            if (!secretRepository.existsById(id)) return ResponseEntity.notFound().build();
            secretRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Delete test suite and all its test cases
     */
    @DeleteMapping("/test-suites/{id}")
    @Transactional
    public ResponseEntity<Void> deleteTestSuite(@PathVariable Long id) {
        try {
            if (!testSuiteRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            // Delete child test cases first (no cascade configured)
            testCaseRepository.deleteBySuiteId(id);
            testSuiteRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Create new test suite
     */
    @PostMapping("/test-suites")
    public ResponseEntity<TestSuite> createTestSuite(@RequestBody TestSuite suite) {
        try {
            suite.setCreatedAt(LocalDateTime.now());
            suite.setUpdatedAt(LocalDateTime.now());
            TestSuite saved = testSuiteRepository.save(suite);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Save request as test case
     */
    @PostMapping("/test-cases/from-request")
    public ResponseEntity<Map<String, Object>> saveRequestAsTestCase(@RequestBody Map<String, Object> request) {
        try {
            TestCase testCase = new TestCase();

            // Basic info
            Object suiteIdVal = request.get("suiteId");
            Object workspaceIdVal = request.get("workspaceId");
            if (suiteIdVal == null || workspaceIdVal == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("success", false);
                error.put("error", "suiteId and workspaceId are required");
                return ResponseEntity.badRequest().body(error);
            }
            testCase.setSuiteId(Long.parseLong(suiteIdVal.toString()));
            testCase.setWorkspaceId(Long.parseLong(workspaceIdVal.toString()));
            testCase.setName((String) request.get("name"));
            testCase.setDescription((String) request.get("description"));

            // Request details
            testCase.setMethod((String) request.get("method"));
            testCase.setEndpoint((String) request.get("endpoint"));

            // Optional swagger references
            if (request.containsKey("swaggerFileId") && request.get("swaggerFileId") != null) {
                testCase.setSwaggerFileId(Long.parseLong(request.get("swaggerFileId").toString()));
            }
            if (request.containsKey("endpointId") && request.get("endpointId") != null) {
                testCase.setEndpointId(Long.parseLong(request.get("endpointId").toString()));
            }

            // Convert params, headers, body to JSON strings
            ObjectMapper mapper = new ObjectMapper();

            if (request.containsKey("params")) {
                testCase.setParams(mapper.writeValueAsString(request.get("params")));
            }

            if (request.containsKey("headers")) {
                testCase.setHeaders(mapper.writeValueAsString(request.get("headers")));
            }

            if (request.containsKey("body")) {
                testCase.setBody(mapper.writeValueAsString(request.get("body")));
            }

            // Expected status
            if (request.containsKey("expectedStatus")) {
                testCase.setExpectedStatus((Integer) request.get("expectedStatus"));
            } else {
                testCase.setExpectedStatus(200); // default
            }

            // Assertions (if provided)
            if (request.containsKey("assertions")) {
                testCase.setAssertions(mapper.writeValueAsString(request.get("assertions")));
            }

            testCase.setCreatedAt(LocalDateTime.now());
            testCase.setUpdatedAt(LocalDateTime.now());

            // Save
            TestCase saved = testCaseRepository.save(testCase);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("testCase", saved);
            response.put("message", "Test case saved successfully!");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get all test cases for a suite
     */
    @GetMapping("/test-cases/suite/{suiteId}")
    public ResponseEntity<List<TestCase>> getTestCasesBySuite(@PathVariable Long suiteId) {
        try {
            List<TestCase> cases = testCaseRepository.findBySuiteIdOrderByCreatedAtDesc(suiteId);
            return ResponseEntity.ok(cases);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(new ArrayList<>());
        }
    }
    /**
     * Get all environments for workspace
     */
    @GetMapping("/environments/workspace/{workspaceId}")
    public ResponseEntity<List<Environment>> getEnvironments(@PathVariable Long workspaceId) {
        try {
            List<Environment> environments = environmentRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);

            // Add variable counts
            for (Environment env : environments) {
                List<EnvironmentVariable> vars = environmentVariableRepository.findByEnvironmentIdOrderByKeyAsc(env.getId());
                env.setVariableCount(vars.size());
            }

            return ResponseEntity.ok(environments);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(new ArrayList<>());
        }
    }

    /**
     * Get active environment for workspace
     */
    @GetMapping("/environments/workspace/{workspaceId}/active")
    public ResponseEntity<Environment> getActiveEnvironment(@PathVariable Long workspaceId) {
        Optional<Environment> activeEnv = environmentRepository.findByWorkspaceIdAndIsActive(workspaceId, true);
        return activeEnv.map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create environment
     */
    @PostMapping("/environments")
    @Transactional
    public ResponseEntity<Environment> createEnvironment(@RequestBody Environment environment) {
        try {
            environment.setCreatedAt(LocalDateTime.now());
            environment.setUpdatedAt(LocalDateTime.now());

            // If setting as active, deactivate others
            if (environment.getIsActive()) {
                environmentRepository.deactivateAllForWorkspace(environment.getWorkspaceId());
            }

            Environment saved = environmentRepository.save(environment);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Set active environment
     */
    @PostMapping("/environments/{id}/activate")
    @Transactional
    public ResponseEntity<Map<String, Object>> activateEnvironment(@PathVariable Long id) {
        try {
            Environment environment = environmentRepository.findById(id).orElseThrow();

            // Deactivate all others in workspace
            environmentRepository.deactivateAllForWorkspace(environment.getWorkspaceId());

            // Activate this one
            environment.setIsActive(true);
            environmentRepository.save(environment);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Environment activated: " + environment.getName());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Delete environment
     */
    @DeleteMapping("/environments/{id}")
    @Transactional
    public ResponseEntity<Void> deleteEnvironment(@PathVariable Long id) {
        try {
            // Delete all variables first
            environmentVariableRepository.deleteByEnvironmentId(id);

            // Delete environment
            environmentRepository.deleteById(id);

            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

// ==================== ENVIRONMENT VARIABLES ====================

    /**
     * Get all variables for environment
     */
    @GetMapping("/environments/{environmentId}/variables")
    public ResponseEntity<List<EnvironmentVariable>> getVariables(@PathVariable Long environmentId) {
        try {
            List<EnvironmentVariable> variables = environmentVariableRepository.findByEnvironmentIdOrderByKeyAsc(environmentId);
            return ResponseEntity.ok(variables);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(new ArrayList<>());
        }
    }

    /**
     * Create or update variable
     */
    @PostMapping("/environments/{environmentId}/variables")
    public ResponseEntity<EnvironmentVariable> saveVariable(
            @PathVariable Long environmentId,
            @RequestBody EnvironmentVariable variable
    ) {
        try {
            variable.setEnvironmentId(environmentId);
            variable.setCreatedAt(LocalDateTime.now());
            variable.setUpdatedAt(LocalDateTime.now());

            EnvironmentVariable saved = environmentVariableRepository.save(variable);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Update variable
     */
    @PutMapping("/environment-variables/{id}")
    public ResponseEntity<EnvironmentVariable> updateVariable(
            @PathVariable Long id,
            @RequestBody EnvironmentVariable variable
    ) {
        try {
            EnvironmentVariable existing = environmentVariableRepository.findById(id).orElseThrow();

            existing.setKey(variable.getKey());
            existing.setValue(variable.getValue());
            existing.setDescription(variable.getDescription());
            existing.setIsSecret(variable.getIsSecret());
            existing.setType(variable.getType());
            existing.setEnabled(variable.getEnabled());
            existing.setUpdatedAt(LocalDateTime.now());

            EnvironmentVariable saved = environmentVariableRepository.save(existing);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Delete variable
     */
    @DeleteMapping("/environment-variables/{id}")
    public ResponseEntity<Void> deleteVariable(@PathVariable Long id) {
        try {
            environmentVariableRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Preview variable substitution
     */
    @PostMapping("/environments/preview-substitution")
    public ResponseEntity<Map<String, String>> previewSubstitution(@RequestBody Map<String, Object> request) {
        try {
            String text = (String) request.get("text");
            Long workspaceId = Long.parseLong(request.get("workspaceId").toString());

            String result = variableSubstitutionService.previewSubstitution(text, workspaceId);

            Map<String, String> response = new HashMap<>();
            response.put("original", text);
            response.put("substituted", result);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Proxy external HTTP requests to avoid browser CORS restrictions
     */
    @PostMapping("/proxy")
    public ResponseEntity<Map<String, Object>> proxyRequest(@RequestBody Map<String, Object> request) {
        long startTime = System.currentTimeMillis();
        try {
            String url    = (String) request.get("url");
            String method = ((String) request.getOrDefault("method", "GET")).toUpperCase();
            String body   = (String) request.get("body");

            @SuppressWarnings("unchecked")
            Map<String, String> headers = (Map<String, String>) request.getOrDefault("headers", new HashMap<>());

            // Use cert-aware client if certId is provided
            Object certIdRaw = request.get("certId");
            HttpClient client;
            if (certIdRaw != null && !certIdRaw.toString().isEmpty()) {
                Long certId = Long.parseLong(certIdRaw.toString());
                client = secretRepository.findById(certId)
                        .map(certificateService::buildJavaHttpClient)
                        .orElseGet(() -> HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build());
            } else {
                client = HttpClient.newBuilder()
                        .followRedirects(HttpClient.Redirect.NORMAL)
                        .build();
            }

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url));

            // Set body publisher
            HttpRequest.BodyPublisher publisher = (body != null && !body.isBlank())
                    ? HttpRequest.BodyPublishers.ofString(body)
                    : HttpRequest.BodyPublishers.noBody();

            reqBuilder.method(method, publisher);

            // Add headers
            headers.forEach((k, v) -> {
                if (!k.equalsIgnoreCase("content-length") && !k.equalsIgnoreCase("host")) {
                    reqBuilder.header(k, v);
                }
            });

            HttpResponse<String> httpResponse = client.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

            long responseTime = System.currentTimeMillis() - startTime;

            // Parse body as JSON if possible
            Object parsedBody;
            try {
                parsedBody = new ObjectMapper().readValue(httpResponse.body(), Object.class);
            } catch (Exception e) {
                parsedBody = httpResponse.body();
            }

            // Collect response headers
            Map<String, String> responseHeaders = new HashMap<>();
            httpResponse.headers().map().forEach((k, v) -> responseHeaders.put(k, String.join(", ", v)));

            Map<String, Object> result = new HashMap<>();
            result.put("status", httpResponse.statusCode());
            result.put("responseTime", responseTime + "ms");
            result.put("size", httpResponse.body().getBytes().length);
            result.put("body", parsedBody);
            result.put("headers", responseHeaders);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            long responseTime = System.currentTimeMillis() - startTime;
            Map<String, Object> error = new HashMap<>();
            error.put("status", 0);
            error.put("responseTime", responseTime + "ms");
            error.put("error", e.getMessage());
            error.put("body", Map.of("error", e.getMessage()));
            return ResponseEntity.status(500).body(error);
        }
    }

    // ── Data-Driven Testing ────────────────────────────────────────────────────

    @PostMapping("/test-cases/{id}/data-driven")
    public ResponseEntity<?> runDataDriven(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        try {
            List<Map<String, Object>> results = dataDrivenService.run(id, file);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/test-cases/{id}/data-driven/template")
    public ResponseEntity<String> getDataDrivenTemplate(@PathVariable Long id) {
        try {
            String csv = dataDrivenService.generateTemplate(id);
            return ResponseEntity.ok()
                    .header("Content-Type", "text/csv")
                    .header("Content-Disposition", "attachment; filename=\"test-data-template.csv\"")
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    // ==================== MOCK SERVER ====================

    @PostMapping("/mock/start")
    public ResponseEntity<Map<String, Object>> startMockServer(@RequestBody Map<String, Object> config) {
        try {
            Long swaggerFileId = Long.valueOf(config.get("swaggerFileId").toString());
            int port = config.containsKey("port") ? Integer.parseInt(config.get("port").toString()) : 8765;
            int delay = config.containsKey("delay") ? Integer.parseInt(config.get("delay").toString()) : 0;
            String strategy = config.containsKey("strategy") ? config.get("strategy").toString() : "smart";
            Map<String, Object> status = mockServerService.start(swaggerFileId, port, delay, strategy);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/mock/stop")
    public ResponseEntity<Map<String, Object>> stopMockServer() {
        mockServerService.stop();
        return ResponseEntity.ok(Map.of("running", false, "message", "Mock server stopped"));
    }

    @GetMapping("/mock/status")
    public ResponseEntity<Map<String, Object>> getMockServerStatus() {
        return ResponseEntity.ok(mockServerService.getStatus());
    }

    @GetMapping("/mock/logs")
    public ResponseEntity<List<Map<String, Object>>> getMockServerLogs() {
        return ResponseEntity.ok(mockServerService.getLogs());
    }

    @DeleteMapping("/mock/logs")
    public ResponseEntity<Void> clearMockServerLogs() {
        mockServerService.clearLogs();
        return ResponseEntity.noContent().build();
    }

    // ==================== LOAD TEST ====================

    @PostMapping("/load-test/start")
    public ResponseEntity<Map<String, Object>> startLoadTest(@RequestBody Map<String, Object> config) {
        try {
            String testId = loadTestService.start(config);
            return ResponseEntity.ok(Map.of("testId", testId, "status", "running"));
        } catch (IllegalStateException e) {
            // Another test is already running
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/load-test/{testId}/status")
    public ResponseEntity<Map<String, Object>> getLoadTestStatus(@PathVariable String testId) {
        return ResponseEntity.ok(loadTestService.getStatus(testId));
    }

    @GetMapping("/load-test/{testId}/results")
    public ResponseEntity<Map<String, Object>> getLoadTestResults(@PathVariable String testId) {
        return ResponseEntity.ok(loadTestService.getResults(testId));
    }

    @PostMapping("/load-test/{testId}/stop")
    public ResponseEntity<Map<String, Object>> stopLoadTest(@PathVariable String testId) {
        boolean stopped = loadTestService.stop(testId);
        return ResponseEntity.ok(Map.of("stopped", stopped));
    }

    @PostMapping("/load-test/preview-fake")
    public ResponseEntity<Map<String, Object>> previewFakeData(@RequestBody Map<String, Object> req) {
        String url     = loadTestService.substituteFakeData(req.getOrDefault("url",     "").toString());
        String headers = loadTestService.substituteFakeData(req.getOrDefault("headers", "").toString());
        String body    = loadTestService.substituteFakeData(req.getOrDefault("body",    "").toString());
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("url",     url);
        result.put("headers", headers);
        result.put("body",    body);
        return ResponseEntity.ok(result);
    }
}
