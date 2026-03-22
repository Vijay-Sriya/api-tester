package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LoadTestResultRepository extends JpaRepository<LoadTestResult, Long> {
    List<LoadTestResult> findByLoadTestConfigIdOrderByExecutedAtDesc(Long loadTestConfigId);
}
