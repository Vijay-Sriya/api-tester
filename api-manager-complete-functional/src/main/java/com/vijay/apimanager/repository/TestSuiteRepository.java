package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.TestSuite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestSuiteRepository extends JpaRepository<TestSuite, Long> {
    List<TestSuite> findByWorkspaceId(Long workspaceId);
    List<TestSuite> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);
}