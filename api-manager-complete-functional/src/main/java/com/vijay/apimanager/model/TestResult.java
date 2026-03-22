package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

// ==================== WORKSPACE ====================

// ==================== TEST RESULT ====================
@Entity
@Table(name = "test_results")
@Data
public class  TestResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "test_case_id", nullable = false)
    private Long testCaseId;
    
    @Column(nullable = false)
    private String status;
    
    @Column(name = "status_code")
    private Integer statusCode;
    
    @Column(name = "response_time")
    private String responseTime;
    
    @Column(columnDefinition = "TEXT")
    private String response;
    
    @Column(columnDefinition = "TEXT")
    private String assertions;
    
    @Column(columnDefinition = "TEXT")
    private String error;
    
    @Column(name = "executed_at")
    private LocalDateTime executedAt;
    
    @PrePersist
    protected void onCreate() {
        executedAt = LocalDateTime.now();
    }
}

