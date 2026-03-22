package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.Endpoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EndpointRepository extends JpaRepository<Endpoint, Long> {
    List<Endpoint> findByWorkspaceIdOrderByPathAsc(Long workspaceId);
    List<Endpoint> findBySwaggerFileId(Long swaggerFileId);
    void deleteBySwaggerFileId(Long swaggerFileId);
}
