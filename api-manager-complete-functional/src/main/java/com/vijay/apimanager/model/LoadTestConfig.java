package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

// ==================== LOAD TEST CONFIG ====================
@Entity
@Table(name = "load_test_configs")
@Data
public class  LoadTestConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;
    
    private String name;
    
    @Column(name = "virtual_users")
    private Integer virtualUsers;
    
    private String duration;
    
    @Column(name = "ramp_up")
    private String rampUp;
    
    private String scenario;
    
    @Column(columnDefinition = "TEXT")
    private String thresholds;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
