package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);
    List<TestCase> findBySuiteIdOrderByCreatedAtDesc(Long suiteId);
    void deleteBySuiteId(Long suiteId);

}
