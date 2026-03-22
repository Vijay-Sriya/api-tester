package com.vijay.apimanager.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestExecutionResult {
    private Long testCaseId;
    private String status; // PASS, FAIL, ERROR, SKIPPED
    private Long duration; // milliseconds
    private Integer statusCode;
    private String responseBody;
    private String responseHeaders;
    private String errorMessage;
    private List<AssertionResult> assertions;
    private LocalDateTime executedAt;

    // Request details (for debugging)
    private String requestMethod;
    private String requestUrl;
    private String requestHeaders;
    private String requestBody;
}