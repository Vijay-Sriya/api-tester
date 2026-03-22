package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.LoadTestConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoadTestConfigRepository extends JpaRepository<LoadTestConfig, Long> {
    List<LoadTestConfig> findByWorkspaceId(Long workspaceId);
}
