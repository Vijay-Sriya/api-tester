package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

// ==================== SWAGGER FILE ====================
@Entity
@Table(name = "swagger_files")
@Data
public class  SwaggerFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;
    
    @Column(nullable = false)
    private String name;
    
    private String version;
    
    @Column(name = "file_path")
    private String filePath;
    
    @Column(nullable = false)
    private String source; // GitHub, GitLab, Local
    
    @Column(name = "source_url")
    private String sourceUrl;
    
    @Column(name = "last_synced")
    private LocalDateTime lastSynced;
    
    private String status; // synced, outdated, error
    
    @Column(name = "endpoint_count")
    private Integer endpointCount = 0;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        lastSynced = LocalDateTime.now();
    }
}
