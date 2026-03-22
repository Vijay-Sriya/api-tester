package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "test_suites", indexes = {
        @Index(name = "idx_test_suite_workspace", columnList = "workspace_id"),
        @Index(name = "idx_test_suite_swagger", columnList = "swagger_file_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestSuite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 50)
    private String type; // regression, smoke, integration, positive, negative, custom

    // Optional swagger reference (hybrid model - loosely coupled)
    @Column(name = "swagger_file_id")
    private Long swaggerFileId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    // Transient fields (not stored in database)
    @Transient
    private String swaggerFileName; // For display purposes

    @Transient
    private Integer testCaseCount; // Number of test cases in this suite

    @Transient
    private Integer passedCount; // Last run statistics

    @Transient
    private Integer failedCount; // Last run statistics

    @Transient
    private Double passRate; // Last run pass rate percentage

    @Transient
    private LocalDateTime lastRunAt; // Last execution time

    @Transient
    private String lastRunStatus; // PASS, FAIL, ERROR, NOT_RUN

    // JPA lifecycle callbacks
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}