package com.vijay.apimanager.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "test_cases", indexes = {
        @Index(name = "idx_test_case_suite", columnList = "suite_id"),
        @Index(name = "idx_test_case_workspace", columnList = "workspace_id"),
        @Index(name = "idx_test_case_swagger", columnList = "swagger_file_id"),
        @Index(name = "idx_test_case_endpoint", columnList = "endpoint_id"),
        @Index(name = "idx_test_case_status", columnList = "last_run_status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Required: Test case belongs to a suite
    @Column(name = "suite_id", nullable = false)
    private Long suiteId;

    // Required: Test case belongs to a workspace
    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    // Basic info
    @Column(nullable = false, length = 500)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Request details - always present
    @Column(nullable = false, length = 10)
    private String method; // GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS

    @Column(nullable = false, length = 1000)
    private String endpoint; // Can be full URL or path

    // Optional swagger references (hybrid model)
    @Column(name = "swagger_file_id")
    private Long swaggerFileId;

    @Column(name = "endpoint_id")
    private Long endpointId;

    // Request data (stored as JSON strings)
    @Column(name = "headers", columnDefinition = "TEXT")
    private String headers; // JSON: {"Content-Type": "application/json", "Authorization": "Bearer ..."}

    @Column(name = "params", columnDefinition = "TEXT")
    private String params; // JSON: {"page": "1", "limit": "10"}

    @Column(name = "body", columnDefinition = "TEXT")
    private String body; // JSON or raw text

    // Expected results
    @Column(name = "expected_status")
    private Integer expectedStatus; // e.g., 200, 201, 404

    @Column(name = "expected_response_time")
    private Integer expectedResponseTime; // in milliseconds

    @Column(name = "assertions", columnDefinition = "TEXT")
    private String assertions; // JSON array of assertion rules

    // Test metadata
    @Column(name = "tags", length = 500)
    private String tags; // Comma-separated: "smoke,critical,auth"

    @Column(name = "priority")
    private Integer priority; // 1 (highest) to 5 (lowest)

    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true; // Can disable without deleting

    @Column(name = "retry_count")
    private Integer retryCount = 0; // Number of retries on failure

    // Last run information
    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Column(name = "last_run_status", length = 20)
    private String lastRunStatus; // PASS, FAIL, ERROR, SKIPPED, NOT_RUN

    @Column(name = "last_run_duration")
    private Long lastRunDuration; // in milliseconds

    @Column(name = "last_run_error", columnDefinition = "TEXT")
    private String lastRunError; // Error message if failed

    // Statistics
    @Column(name = "total_runs")
    private Integer totalRuns = 0;

    @Column(name = "passed_runs")
    private Integer passedRuns = 0;

    @Column(name = "failed_runs")
    private Integer failedRuns = 0;

    @Column(name = "avg_duration")
    private Long avgDuration; // Average execution time

    // Timestamps
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    // Transient fields (calculated/loaded separately)
    @Transient
    private boolean isLinkedToSwagger; // True if swaggerFileId or endpointId is set

    @Transient
    private boolean hasDrifted; // True if linked swagger has changed

    @Transient
    private String swaggerFileName; // For display

    @Column(name = "base_url", length = 500)
    private String baseUrl;

    @Column(name = "path_params", columnDefinition = "TEXT")
    private String pathParams; // JSON: {"itemId": "123", "orderId": "456"}

    /** Optional: client certificate (Secret.type=certificate) to use for this test */
    @Column(name = "cert_id")
    private Long certId;

    @Transient
    private String endpointPath; // For display

    @Transient
    private String suiteName; // For display

    @Transient
    private List<String> tagsList; // Parsed from tags string

    @Transient
    private Double passRate; // Calculated: passedRuns / totalRuns * 100

    @Transient
    @JsonProperty("isFlaky") // For JSON serialization
    private Boolean isFlaky; // True if test has inconsistent results

    // JPA lifecycle callbacks
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (enabled == null) {
            enabled = true;
        }
        if (totalRuns == null) {
            totalRuns = 0;
        }
        if (passedRuns == null) {
            passedRuns = 0;
        }
        if (failedRuns == null) {
            failedRuns = 0;
        }
        if (retryCount == null) {
            retryCount = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Helper methods

    /**
     * Check if this test case is linked to a swagger spec
     */
    public boolean isLinkedToSwagger() {
        return swaggerFileId != null || endpointId != null;
    }

    /**
     * Parse tags string into list
     */
    public List<String> getTagsList() {
        if (tags == null || tags.trim().isEmpty()) {
            return new ArrayList<>();
        }
        return List.of(tags.split(","));
    }

    /**
     * Calculate pass rate
     */
    public Double getPassRate() {
        if (totalRuns == null || totalRuns == 0) {
            return null;
        }
        return (passedRuns.doubleValue() / totalRuns.doubleValue()) * 100.0;
    }

    /**
     * Check if test is flaky (inconsistent results)
     */
    public Boolean getIsFlaky() {
        if (totalRuns == null || totalRuns < 3) {
            return false; // Need at least 3 runs to determine
        }
        Double passRate = getPassRate();
        if (passRate == null) {
            return false;
        }
        // Consider flaky if pass rate is between 20% and 80%
        return passRate > 20.0 && passRate < 80.0;
    }

    /**
     * Update statistics after a test run
     */
    public void updateStatistics(String status, Long duration) {
        this.lastRunAt = LocalDateTime.now();
        this.lastRunStatus = status;
        this.lastRunDuration = duration;

        if (this.totalRuns == null) {
            this.totalRuns = 0;
        }
        if (this.passedRuns == null) {
            this.passedRuns = 0;
        }
        if (this.failedRuns == null) {
            this.failedRuns = 0;
        }

        this.totalRuns++;

        if ("PASS".equals(status)) {
            this.passedRuns++;
        } else if ("FAIL".equals(status) || "ERROR".equals(status)) {
            this.failedRuns++;
        }

        // Update average duration
        if (this.avgDuration == null) {
            this.avgDuration = duration;
        } else {
            this.avgDuration = (this.avgDuration * (this.totalRuns - 1) + duration) / this.totalRuns;
        }
    }
}