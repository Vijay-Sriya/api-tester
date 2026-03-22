package com.vijay.apimanager.service;

import com.vijay.apimanager.model.*;
import com.vijay.apimanager.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class WorkspaceService {
    
    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private SwaggerFileRepository swaggerFileRepository;

    @Autowired
    private EndpointRepository endpointRepository;

    @Autowired
    private TestCaseRepository testCaseRepository;

    @Autowired
    private TestResultRepository testResultRepository;

    @Autowired
    private TestSuiteRepository testSuiteRepository;

    @Autowired
    private EnvironmentVariableRepository environmentVariableRepository;

    @Autowired
    private EnvironmentRepository environmentRepository;

    @Autowired
    private SecretRepository secretRepository;

    @Autowired
    private LoadTestResultRepository loadTestResultRepository;

    @Autowired
    private LoadTestConfigRepository loadTestConfigRepository;
    
    public List<Workspace> findAll() {
        return workspaceRepository.findAllByOrderByUpdatedAtDesc();
    }
    
    public Optional<Workspace> findById(Long id) {
        return workspaceRepository.findById(id);
    }
    
    public Workspace create(Workspace workspace) {
        return workspaceRepository.save(workspace);
    }
    
    public Workspace update(Long id, Workspace workspace) {
        workspace.setId(id);
        return workspaceRepository.save(workspace);
    }
    
    @Transactional
    public void delete(Long id) {
        // 1. Delete test results for all test cases in this workspace
        testCaseRepository.findByWorkspaceIdOrderByCreatedAtDesc(id)
            .forEach(tc -> testResultRepository.deleteByTestCaseId(tc.getId()));

        // 2. Delete test cases
        testCaseRepository.deleteByWorkspaceId(id);

        // 3. Delete test suites
        testSuiteRepository.deleteByWorkspaceId(id);

        // 4. Delete environment variables for all environments in this workspace
        environmentRepository.findByWorkspaceIdOrderByCreatedAtDesc(id)
            .forEach(env -> environmentVariableRepository.deleteByEnvironmentId(env.getId()));

        // 5. Delete environments
        environmentRepository.deleteByWorkspaceId(id);

        // 6. Delete secrets
        secretRepository.deleteByWorkspaceId(id);

        // 7. Delete load test results for all load test configs in this workspace
        loadTestConfigRepository.findByWorkspaceId(id)
            .forEach(cfg -> loadTestResultRepository.deleteByLoadTestConfigId(cfg.getId()));

        // 8. Delete load test configs
        loadTestConfigRepository.deleteByWorkspaceId(id);

        // 9. Delete endpoints and swagger files
        swaggerFileRepository.findByWorkspaceIdOrderByCreatedAtDesc(id)
            .forEach(swagger -> {
                endpointRepository.deleteBySwaggerFileId(swagger.getId());
                swaggerFileRepository.delete(swagger);
            });

        // 10. Delete workspace
        workspaceRepository.deleteById(id);
    }
    
    public Map<String, Object> getWorkspaceData(Long id) {
        Map<String, Object> data = new HashMap<>();
        
        // Get workspace
        Optional<Workspace> workspace = findById(id);
        if (workspace.isEmpty()) {
            throw new RuntimeException("Workspace not found");
        }
        
        // Get related data
        List<SwaggerFile> swaggerFiles = swaggerFileRepository.findByWorkspaceIdOrderByCreatedAtDesc(id);
        List<Endpoint> endpoints = endpointRepository.findByWorkspaceIdOrderByPathAsc(id);
        List<TestCase> testCases = testCaseRepository.findByWorkspaceIdOrderByCreatedAtDesc(id);
        
        data.put("workspace", workspace.get());
        data.put("swaggerFiles", swaggerFiles);
        data.put("endpoints", endpoints);
        data.put("testCases", testCases);
        
        return data;
    }
}
