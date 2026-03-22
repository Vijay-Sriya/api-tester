package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "environment_variables", indexes = {
        @Index(name = "idx_env_var_environment", columnList = "environment_id"),
        @Index(name = "idx_env_var_key", columnList = "var_key")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnvironmentVariable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "environment_id", nullable = false)
    private Long environmentId;

    @Column(name = "var_key", nullable = false, length = 200)
    private String key; // fraud-base-qa-url, api-key, auth-token

    @Column(name = "var_value", columnDefinition = "TEXT", nullable = false)
    private String value;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_secret", nullable = false)
    private Boolean isSecret = false; // If true, mask in UI

    @Column(name = "var_type", length = 50)
    private String type; // text, url, secret, number

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (isSecret == null) {
            isSecret = false;
        }
        if (enabled == null) {
            enabled = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Get masked value for display
     */
    public String getMaskedValue() {
        if (isSecret && value != null && value.length() > 4) {
            return value.substring(0, 4) + "****" + value.substring(value.length() - 4);
        }
        return value;
    }
}