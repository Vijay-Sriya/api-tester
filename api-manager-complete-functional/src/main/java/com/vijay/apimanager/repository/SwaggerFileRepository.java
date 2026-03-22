package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.SwaggerFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SwaggerFileRepository extends JpaRepository<SwaggerFile, Long> {
    List<SwaggerFile> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);
}
