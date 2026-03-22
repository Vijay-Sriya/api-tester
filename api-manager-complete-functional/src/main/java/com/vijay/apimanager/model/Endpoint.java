package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

// ==================== ENDPOINT ====================
@Entity
@Table(name = "endpoints")
@Data
public class  Endpoint {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;
    
    @Column(name = "swagger_file_id")
    private Long swaggerFileId;
    
    @Column(nullable = false)
    private String method;
    
    @Column(nullable = false)
    private String path;
    
    private String summary;
    
    @Column(length = 2000)
    private String description;
    
    @Column(name = "request_schema", columnDefinition = "TEXT")
    private String requestSchema;
    
    @Column(name = "response_schema", columnDefinition = "TEXT")
    private String responseSchema;
    
    @Column(columnDefinition = "TEXT")
    private String tags;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
