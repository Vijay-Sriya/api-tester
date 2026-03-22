package com.vijay.apimanager.service;

import com.vijay.apimanager.model.*;
import com.vijay.apimanager.repository.*;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.SwaggerParseResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class SwaggerService {
    
    @Autowired
    private SwaggerFileRepository swaggerFileRepository;
    
    @Autowired
    private EndpointRepository endpointRepository;
    
    @Value("${app.database-path:${user.home}/.api-manager}")
    private String appDataPath;
    
    public List<SwaggerFile> findByWorkspaceId(Long workspaceId) {
        return swaggerFileRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);
    }
    
    public Optional<SwaggerFile> findById(Long id) {
        return swaggerFileRepository.findById(id);
    }
    
    /**
     * Upload and parse a local Swagger file
     */
    @Transactional
    public SwaggerFile uploadFile(Long workspaceId, MultipartFile file) throws IOException {
        // Create uploads directory
        Path uploadsDir = java.nio.file.Paths.get(appDataPath, "uploads");
        Files.createDirectories(uploadsDir);
        
        // Save file
        String filename = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path filePath = uploadsDir.resolve(filename);
        Files.write(filePath, file.getBytes());
        
        // Create swagger record
        SwaggerFile swagger = new SwaggerFile();
        swagger.setWorkspaceId(workspaceId);
        swagger.setName(file.getOriginalFilename());
        swagger.setSource("Local");
        swagger.setFilePath(filePath.toString());
        swagger.setStatus("pending");
        
        swagger = swaggerFileRepository.save(swagger);
        
        // Parse and extract endpoints
        parseAndExtractEndpoints(swagger);
        
        return swagger;
    }
    
    /**
     * Add Swagger from URL (GitHub/GitLab)
     */
    @Transactional
    public SwaggerFile addFromUrl(Long workspaceId, String name, String url, String source) {
        SwaggerFile swagger = new SwaggerFile();
        swagger.setWorkspaceId(workspaceId);
        swagger.setName(name);
        swagger.setSource(source);
        swagger.setSourceUrl(url);
        swagger.setStatus("pending");
        
        swagger = swaggerFileRepository.save(swagger);
        
        // Try to parse from URL
        try {
            parseFromUrl(swagger, url);
        } catch (Exception e) {
            swagger.setStatus("error");
            swaggerFileRepository.save(swagger);
            throw new RuntimeException("Failed to parse Swagger from URL: " + e.getMessage());
        }
        
        return swagger;
    }
    
    /**
     * Refresh Swagger from source
     */
    @Transactional
    public SwaggerFile refresh(Long id) {
        SwaggerFile swagger = swaggerFileRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Swagger file not found"));
        
        // Delete existing endpoints
        endpointRepository.deleteBySwaggerFileId(id);
        
        // Re-parse based on source
        if ("Local".equals(swagger.getSource())) {
            parseAndExtractEndpoints(swagger);
        } else {
            parseFromUrl(swagger, swagger.getSourceUrl());
        }
        
        swagger.setLastSynced(LocalDateTime.now());
        return swaggerFileRepository.save(swagger);
    }
    
    /**
     * Delete Swagger and its endpoints
     */
    @Transactional
    public void delete(Long id) {
        endpointRepository.deleteBySwaggerFileId(id);
        swaggerFileRepository.deleteById(id);
    }
    
    /**
     * Parse Swagger file from local path
     */
    private void parseAndExtractEndpoints(SwaggerFile swagger) {
        try {
            SwaggerParseResult result = new OpenAPIV3Parser().readLocation(swagger.getFilePath(), null, null);
            OpenAPI openAPI = result.getOpenAPI();
            
            if (openAPI == null) {
                swagger.setStatus("error");
                swaggerFileRepository.save(swagger);
                return;
            }
            
            // Extract version
            if (openAPI.getInfo() != null) {
                swagger.setVersion(openAPI.getInfo().getVersion());
            }
            
            // Extract endpoints
            int count = extractEndpoints(swagger, openAPI);
            
            swagger.setEndpointCount(count);
            swagger.setStatus("synced");
            swagger.setLastSynced(LocalDateTime.now());
            swaggerFileRepository.save(swagger);
            
        } catch (Exception e) {
            swagger.setStatus("error");
            swaggerFileRepository.save(swagger);
            throw new RuntimeException("Failed to parse Swagger: " + e.getMessage());
        }
    }
    
    /**
     * Parse Swagger from URL
     */
    private void parseFromUrl(SwaggerFile swagger, String url) {
        try {
            SwaggerParseResult result = new OpenAPIV3Parser().readLocation(url, null, null);
            OpenAPI openAPI = result.getOpenAPI();
            
            if (openAPI == null) {
                swagger.setStatus("error");
                swaggerFileRepository.save(swagger);
                throw new RuntimeException("Failed to parse OpenAPI from URL");
            }
            
            // Extract version
            if (openAPI.getInfo() != null) {
                swagger.setVersion(openAPI.getInfo().getVersion());
            }
            
            // Extract endpoints
            int count = extractEndpoints(swagger, openAPI);
            
            swagger.setEndpointCount(count);
            swagger.setStatus("synced");
            swagger.setLastSynced(LocalDateTime.now());
            swaggerFileRepository.save(swagger);
            
        } catch (Exception e) {
            swagger.setStatus("error");
            swaggerFileRepository.save(swagger);
            throw new RuntimeException("Failed to parse from URL: " + e.getMessage());
        }
    }
    
    /**
     * Extract endpoints from OpenAPI spec
     */
    private int extractEndpoints(SwaggerFile swagger, OpenAPI openAPI) {
        Paths paths = openAPI.getPaths();
        if (paths == null) {
            return 0;
        }
        
        int count = 0;
        
        for (Map.Entry<String, PathItem> entry : paths.entrySet()) {
            String path = entry.getKey();
            PathItem pathItem = entry.getValue();
            
            // Process each HTTP method
            for (Map.Entry<PathItem.HttpMethod, Operation> opEntry : pathItem.readOperationsMap().entrySet()) {
                Endpoint endpoint = new Endpoint();
                endpoint.setWorkspaceId(swagger.getWorkspaceId());
                endpoint.setSwaggerFileId(swagger.getId());
                endpoint.setMethod(opEntry.getKey().name());
                endpoint.setPath(path);
                
                Operation operation = opEntry.getValue();
                endpoint.setSummary(operation.getSummary());
                endpoint.setDescription(operation.getDescription());
                
                // Extract tags
                if (operation.getTags() != null && !operation.getTags().isEmpty()) {
                    endpoint.setTags(String.join(",", operation.getTags()));
                }
                
                endpointRepository.save(endpoint);
                count++;
            }
        }
        
        return count;
    }
}
