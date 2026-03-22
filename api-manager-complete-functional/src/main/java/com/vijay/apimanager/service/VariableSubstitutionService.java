package com.vijay.apimanager.service;


import com.vijay.apimanager.model.Environment;
import com.vijay.apimanager.model.EnvironmentVariable;
import com.vijay.apimanager.repository.EnvironmentRepository;
import com.vijay.apimanager.repository.EnvironmentVariableRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class VariableSubstitutionService {

    @Autowired
    private EnvironmentRepository environmentRepository;

    @Autowired
    private EnvironmentVariableRepository environmentVariableRepository;

    // Pattern to match {{variable}} or $(variable)
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{([^}]+)\\}\\}|\\$\\(([^)]+)\\)");

    /**
     * Replace all variables in text with actual values
     */
    public String substituteVariables(String text, Long workspaceId) {
        if (text == null || text.trim().isEmpty()) {
            return text;
        }

        // Get active environment for workspace
        Optional<Environment> activeEnv = environmentRepository.findByWorkspaceIdAndIsActive(workspaceId, true);
        if (activeEnv.isEmpty()) {
            return text; // No active environment, return as-is
        }

        // Load all variables
        Map<String, String> variablesMap = loadVariablesMap(activeEnv.get().getId());

        // Replace all occurrences
        return replaceVariables(text, variablesMap);
    }

    /**
     * Replace variables in text using provided map
     */
    public String replaceVariables(String text, Map<String, String> variablesMap) {
        if (text == null || variablesMap == null || variablesMap.isEmpty()) {
            return text;
        }

        Matcher matcher = VARIABLE_PATTERN.matcher(text);
        StringBuffer result = new StringBuffer();

        while (matcher.find()) {
            // Get variable name (from either {{var}} or $(var) format)
            String variableName = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);

            // Get replacement value
            String replacement = variablesMap.get(variableName);

            if (replacement != null) {
                // Escape special characters in replacement
                matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
            } else {
                // Variable not found, keep original
                matcher.appendReplacement(result, Matcher.quoteReplacement(matcher.group()));
            }
        }

        matcher.appendTail(result);
        return result.toString();
    }

    /**
     * Load all variables into a map
     */
    public Map<String, String> loadVariablesMap(Long environmentId) {
        List<EnvironmentVariable> variables = environmentVariableRepository
                .findByEnvironmentIdAndEnabledOrderByKeyAsc(environmentId, true);

        Map<String, String> map = new HashMap<>();
        for (EnvironmentVariable var : variables) {
            map.put(var.getKey(), var.getValue());
        }

        return map;
    }

    /**
     * Substitute variables in all test case fields
     */
    public Map<String, Object> substituteInTestCase(
            String endpoint,
            String headers,
            String params,
            String body,
            String baseUrl,
            Long workspaceId
    ) {
        Map<String, Object> result = new HashMap<>();

        // Substitute in each field
        result.put("endpoint", substituteVariables(endpoint, workspaceId));
        result.put("headers", substituteVariables(headers, workspaceId));
        result.put("params", substituteVariables(params, workspaceId));
        result.put("body", substituteVariables(body, workspaceId));
        result.put("baseUrl", substituteVariables(baseUrl, workspaceId));

        return result;
    }

    /**
     * Substitute variables in all test case fields, with extra vars (e.g. from CSV row) overriding env vars
     */
    public Map<String, Object> substituteInTestCase(
            String endpoint, String headers, String params, String body, String baseUrl,
            Long workspaceId, Map<String, String> extraVars) {

        // Build combined variable map: env vars as base, extraVars override
        Map<String, String> combined = new HashMap<>();
        Optional<Environment> activeEnv = environmentRepository.findByWorkspaceIdAndIsActive(workspaceId, true);
        activeEnv.ifPresent(env -> combined.putAll(loadVariablesMap(env.getId())));
        if (extraVars != null) combined.putAll(extraVars);

        Map<String, Object> result = new HashMap<>();
        result.put("endpoint", replaceVariables(endpoint, combined));
        result.put("headers",  replaceVariables(headers,  combined));
        result.put("params",   replaceVariables(params,   combined));
        result.put("body",     replaceVariables(body,     combined));
        result.put("baseUrl",  replaceVariables(baseUrl,  combined));
        return result;
    }

    /**
     * Get all variables for an environment
     */
    public Map<String, String> getVariablesForEnvironment(Long environmentId) {
        return loadVariablesMap(environmentId);
    }

    /**
     * Preview substitution (for UI)
     */
    public String previewSubstitution(String text, Long workspaceId) {
        return substituteVariables(text, workspaceId);
    }
}