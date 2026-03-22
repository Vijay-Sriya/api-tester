package com.vijay.apimanager.repository;

import com.vijay.apimanager.model.EnvironmentVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnvironmentVariableRepository extends JpaRepository<EnvironmentVariable, Long> {
    List<EnvironmentVariable> findByEnvironmentIdOrderByKeyAsc(Long environmentId);
    List<EnvironmentVariable> findByEnvironmentIdAndEnabledOrderByKeyAsc(Long environmentId, Boolean enabled);
    Optional<EnvironmentVariable> findByEnvironmentIdAndKey(Long environmentId, String key);
    void deleteByEnvironmentId(Long environmentId);
}