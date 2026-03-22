package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.Environment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnvironmentRepository extends JpaRepository<Environment, Long> {
    List<Environment> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);
    Optional<Environment> findByWorkspaceIdAndIsActive(Long workspaceId, Boolean isActive);

    @Modifying
    @Query("UPDATE Environment e SET e.isActive = false WHERE e.workspaceId = :workspaceId")
    void deactivateAllForWorkspace(@Param("workspaceId") Long workspaceId);
}