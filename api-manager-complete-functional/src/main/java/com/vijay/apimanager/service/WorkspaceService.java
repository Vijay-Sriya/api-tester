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
        // Delete related entities
        swaggerFileRepository.findByWorkspaceIdOrderByCreatedAtDesc(id)
            .forEach(swagger -> {
                endpointRepository.deleteBySwaggerFileId(swagger.getId());
                swaggerFileRepository.delete(swagger);
            });
        
        testCaseRepository.findByWorkspaceIdOrderByCreatedAtDesc(id)
            .forEach(testCaseRepository::delete);
        
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
