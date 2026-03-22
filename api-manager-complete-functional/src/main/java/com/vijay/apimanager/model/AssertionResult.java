package com.vijay.apimanager.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssertionResult {
    private String type; // STATUS, TIME, CONTAINS, BODY_FIELD, HEADER, REGEX, SCHEMA
    private String field; // Field being asserted (e.g., "response.status", "body.email")
    private String operator; // EQUALS, NOT_EQUALS, CONTAINS, GREATER_THAN, LESS_THAN, MATCHES
    private Object expected;
    private Object actual;
    private boolean passed;
    private String message; // Human-readable description
    private String errorMessage; // Error message if failed
}
