package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.TestResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestResultRepository extends JpaRepository<TestResult, Long> {
    List<TestResult> findByTestCaseIdOrderByExecutedAtDesc(Long testCaseId);
    void deleteByTestCaseId(Long testCaseId);
}
