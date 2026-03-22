package com.vijay.apimanager.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "secrets")
@Data
public class Secret {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type; // string, certificate

    @Column(name = "encrypted_value", columnDefinition = "TEXT")
    private String encryptedValue;

    @Column(nullable = false)
    private String environment; // production, staging, development

    @Column(name = "last_used")
    private LocalDateTime lastUsed;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // ── Certificate-specific fields (null for type=string) ──

    /** PKCS12 or PEM */
    @Column(name = "cert_type", length = 20)
    private String certType;

    /** Passphrase for PKCS12 keystores */
    @Column(name = "passphrase", length = 500)
    private String passphrase;

    /** Certificate expiry — shown as warning in UI */
    @Column(name = "expires_at")
    private LocalDate expiresAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
