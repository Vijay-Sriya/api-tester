package com.vijay.apimanager.service;

import com.vijay.apimanager.model.Secret;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactoryBuilder;
import org.apache.hc.core5.ssl.SSLContexts;
import org.springframework.stereotype.Service;

import javax.net.ssl.SSLContext;
import java.io.ByteArrayInputStream;
import java.net.http.HttpClient;
import java.security.KeyStore;
import java.time.Duration;
import java.util.Base64;

@Service
public class CertificateService {

    @Autowired
    private EncryptionService encryptionService;

    /**
     * Build an Apache HttpClient 5 configured with the given client certificate.
     * Used by TestCaseService.
     */
    public CloseableHttpClient buildApacheClient(Secret cert) {
        try {
            SSLContext sslContext = buildSslContext(cert);
            // HttpClient 5: SSLContext must be wired via SSLConnectionSocketFactory → connection manager
            return HttpClients.custom()
                    .setConnectionManager(
                        PoolingHttpClientConnectionManagerBuilder.create()
                            .setSSLSocketFactory(
                                SSLConnectionSocketFactoryBuilder.create()
                                    .setSslContext(sslContext)
                                    .build())
                            .build())
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to build HTTP client with certificate '" + cert.getName() + "': " + e.getMessage(), e);
        }
    }

    /**
     * Build a java.net.http.HttpClient configured with the given client certificate.
     * Used by LoadTestService.
     */
    public HttpClient buildJavaHttpClient(Secret cert) {
        try {
            SSLContext sslContext = buildSslContext(cert);
            return HttpClient.newBuilder()
                    .sslContext(sslContext)
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to build HTTP client with certificate '" + cert.getName() + "': " + e.getMessage(), e);
        }
    }

    private SSLContext buildSslContext(Secret cert) throws Exception {
        // Decrypt the AES-GCM encrypted value, then base64-decode to raw cert bytes
        String decryptedBase64 = encryptionService.decrypt(cert.getEncryptedValue());
        byte[] certBytes = Base64.getDecoder().decode(decryptedBase64);
        char[] passphrase = cert.getPassphrase() != null ? cert.getPassphrase().toCharArray() : new char[0];
        String certType = cert.getCertType() != null ? cert.getCertType().toUpperCase() : "PKCS12";
        String keystoreType = "JKS".equals(certType) ? "JKS" : "PKCS12";

        KeyStore keyStore = KeyStore.getInstance(keystoreType);
        keyStore.load(new ByteArrayInputStream(certBytes), passphrase);

        return SSLContexts.custom()
                .loadKeyMaterial(keyStore, passphrase)
                .build();
    }
}
