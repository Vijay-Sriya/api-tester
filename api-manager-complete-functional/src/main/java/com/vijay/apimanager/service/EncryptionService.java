package com.vijay.apimanager.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-256-GCM encryption for sensitive values stored in the database.
 * Key is derived from app.secrets.master-key via PBKDF2 (65 536 iterations).
 * Stored format: Base64( IV[12] || Ciphertext+AuthTag )
 */
@Service
public class EncryptionService {

    private static final String ALGORITHM  = "AES/GCM/NoPadding";
    private static final int    IV_BYTES   = 12;
    private static final int    TAG_BITS   = 128;
    private static final byte[] SALT       = "api-manager-v1-salt".getBytes(StandardCharsets.UTF_8);

    private final SecretKey secretKey;

    public EncryptionService(@Value("${app.secrets.master-key}") String masterKey) throws Exception {
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        KeySpec spec = new PBEKeySpec(masterKey.toCharArray(), SALT, 65_536, 256);
        SecretKey tmp = factory.generateSecret(spec);
        this.secretKey = new SecretKeySpec(tmp.getEncoded(), "AES");
    }

    /** Encrypt plaintext — returns a single Base64 string safe for DB storage. */
    public String encrypt(String plaintext) throws Exception {
        byte[] iv = new byte[IV_BYTES];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(TAG_BITS, iv));
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        // Prepend IV so we can recover it at decrypt time
        byte[] combined = new byte[IV_BYTES + ciphertext.length];
        System.arraycopy(iv,         0, combined, 0,        IV_BYTES);
        System.arraycopy(ciphertext, 0, combined, IV_BYTES, ciphertext.length);
        return Base64.getEncoder().encodeToString(combined);
    }

    /** Decrypt a value previously produced by {@link #encrypt}. */
    public String decrypt(String encrypted) throws Exception {
        byte[] combined   = Base64.getDecoder().decode(encrypted);
        byte[] iv         = Arrays.copyOfRange(combined, 0,        IV_BYTES);
        byte[] ciphertext = Arrays.copyOfRange(combined, IV_BYTES, combined.length);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(TAG_BITS, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }
}
