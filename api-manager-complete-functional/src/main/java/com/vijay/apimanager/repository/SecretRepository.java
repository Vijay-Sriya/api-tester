package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.Secret;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SecretRepository extends JpaRepository<Secret, Long> {
    List<Secret> findByWorkspaceIdAndEnvironment(Long workspaceId, String environment);
    List<Secret> findByWorkspaceId(Long workspaceId);
    List<Secret> findByWorkspaceIdAndType(Long workspaceId, String type);
    void deleteByWorkspaceId(Long workspaceId);
}
