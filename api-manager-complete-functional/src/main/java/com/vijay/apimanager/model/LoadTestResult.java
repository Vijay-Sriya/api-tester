package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

// ==================== LOAD TEST RESULT ====================
@Entity
@Table(name = "load_test_results")
@Data
public class  LoadTestResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "load_test_config_id", nullable = false)
    private Long loadTestConfigId;
    
    @Column(name = "total_requests")
    private Integer totalRequests;
    
    @Column(name = "successful_requests")
    private Integer successfulRequests;
    
    @Column(name = "failed_requests")
    private Integer failedRequests;
    
    @Column(name = "avg_response_time")
    private String avgResponseTime;
    
    private String p50;
    private String p95;
    private String p99;
    
    @Column(name = "max_response_time")
    private String maxResponseTime;
    
    private String rps;
    
    @Column(name = "success_rate")
    private String successRate;
    
    @Column(name = "error_rate")
    private String errorRate;
    
    @Column(columnDefinition = "TEXT")
    private String resultsJson;
    
    @Column(name = "executed_at")
    private LocalDateTime executedAt;
    
    @PrePersist
    protected void onCreate() {
        executedAt = LocalDateTime.now();
    }
}
