package com.vijay.apimanager.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.vijay.apimanager.faker.FakeDataGenerator;
import com.vijay.apimanager.model.SwaggerFile;
import com.vijay.apimanager.repository.SwaggerFileRepository;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.parser.OpenAPIV3Parser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class MockServerService {

    @Autowired
    private SwaggerFileRepository swaggerFileRepository;

    @Autowired
    private FakeDataGenerator fakeDataGenerator;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private HttpServer httpServer;
    private volatile boolean running = false;
    private volatile int currentPort;
    private volatile Long currentSwaggerFileId;
    private volatile int delayMs = 0;

    // Ring buffer for logs (max 500)
    private final Deque<Map<String, Object>> requestLogs = new ArrayDeque<>(500);

    // Registered mock routes: pattern -> handler info
    private final List<MockRoute> routes = new ArrayList<>();

    // ======================== PUBLIC API ========================

    public Map<String, Object> start(Long swaggerFileId, int port, int delayMs, String strategy) throws Exception {
        if (running) stop();

        SwaggerFile swaggerFile = swaggerFileRepository.findById(swaggerFileId)
                .orElseThrow(() -> new RuntimeException("Swagger file not found: " + swaggerFileId));

        // Parse the swagger file to build routes
        OpenAPI openAPI = new OpenAPIV3Parser().read(swaggerFile.getFilePath());
        if (openAPI == null) throw new RuntimeException("Failed to parse Swagger file");

        routes.clear();
        requestLogs.clear();

        if (openAPI.getPaths() != null) {
            for (Map.Entry<String, PathItem> entry : openAPI.getPaths().entrySet()) {
                String path = entry.getKey();
                PathItem pathItem = entry.getValue();
                buildRoutes(path, pathItem, openAPI, strategy);
            }
        }

        // Start the HTTP server
        httpServer = HttpServer.create(new InetSocketAddress(port), 0);
        httpServer.setExecutor(Executors.newCachedThreadPool());

        // Single catch-all context
        this.delayMs = delayMs;
        httpServer.createContext("/", exchange -> handleRequest(exchange));
        httpServer.start();

        running = true;
        currentPort = port;
        currentSwaggerFileId = swaggerFileId;

        addLog("SYSTEM", "Mock server started on port " + port + " with " + routes.size() + " endpoints from: " + swaggerFile.getName(), null, null);

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("running", true);
        status.put("port", port);
        status.put("swaggerFileId", swaggerFileId);
        status.put("swaggerName", swaggerFile.getName());
        status.put("endpointCount", routes.size());
        status.put("endpoints", routes.stream().map(r -> r.method + " " + r.pathPattern).collect(Collectors.toList()));
        return status;
    }

    public void stop() {
        if (httpServer != null) {
            addLog("SYSTEM", "Mock server stopping...", null, null);
            httpServer.stop(0);
            httpServer = null;
        }
        running = false;
        routes.clear();
    }

    public Map<String, Object> getStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("running", running);
        status.put("port", running ? currentPort : null);
        status.put("swaggerFileId", running ? currentSwaggerFileId : null);
        status.put("endpointCount", routes.size());
        status.put("endpoints", routes.stream().map(r -> r.method + " " + r.pathPattern).collect(Collectors.toList()));
        return status;
    }

    public List<Map<String, Object>> getLogs() {
        synchronized (requestLogs) {
            return new ArrayList<>(requestLogs);
        }
    }

    public void clearLogs() {
        synchronized (requestLogs) {
            requestLogs.clear();
        }
    }

    // ======================== REQUEST HANDLER ========================

    private void handleRequest(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase();
        String path = exchange.getRequestURI().getPath();
        String query = exchange.getRequestURI().getQuery();
        long start = System.currentTimeMillis();

        // Collect request headers
        Map<String, String> reqHeaders = new LinkedHashMap<>();
        exchange.getRequestHeaders().forEach((k, v) -> reqHeaders.put(k, String.join(", ", v)));

        // Apply delay
        if (delayMs > 0) {
            try { Thread.sleep(delayMs); } catch (InterruptedException ignored) {}
        }

        // Find matching route
        MockRoute matched = null;
        Map<String, String> pathParams = new LinkedHashMap<>();
        for (MockRoute route : routes) {
            if (!route.method.equals(method) && !route.method.equals("ANY")) continue;
            Map<String, String> params = route.match(path);
            if (params != null) {
                matched = route;
                pathParams = params;
                break;
            }
        }

        byte[] responseBytes;
        int statusCode;
        String contentType = "application/json";

        if (matched != null) {
            statusCode = matched.responseStatus;
            try {
                Object body = matched.responseBody;
                // Replace {param} placeholders in body values (only for Map responses)
                if (body instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> bodyMap = new LinkedHashMap<>((Map<String, Object>) body);
                    for (Map.Entry<String, String> pp : pathParams.entrySet()) {
                        replaceInMap(bodyMap, "{" + pp.getKey() + "}", pp.getValue());
                    }
                    body = bodyMap;
                }
                responseBytes = objectMapper.writeValueAsBytes(body);
            } catch (Exception e) {
                responseBytes = ("{\"error\":\"" + e.getMessage() + "\"}").getBytes();
                statusCode = 500;
            }
        } else {
            statusCode = 404;
            responseBytes = ("{\"error\":\"No mock route found for " + method + " " + path + "\"}").getBytes();
        }

        long duration = System.currentTimeMillis() - start;

        // Send response
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "*");
        exchange.getResponseHeaders().set("X-Mock-Server", "API-Manager-Pro");

        if (method.equals("OPTIONS")) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            addLog(method, path + (query != null ? "?" + query : ""), 204, duration);
            return;
        }

        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
        exchange.close();

        addLog(method, path + (query != null ? "?" + query : ""), statusCode, duration);
    }

    // ======================== ROUTE BUILDING ========================

    private void buildRoutes(String path, PathItem pathItem, OpenAPI openAPI, String strategy) {
        buildRoute("GET",    path, pathItem.getGet(),    openAPI, strategy);
        buildRoute("POST",   path, pathItem.getPost(),   openAPI, strategy);
        buildRoute("PUT",    path, pathItem.getPut(),    openAPI, strategy);
        buildRoute("DELETE", path, pathItem.getDelete(), openAPI, strategy);
        buildRoute("PATCH",  path, pathItem.getPatch(),  openAPI, strategy);
    }

    private void buildRoute(String method, String path, Operation operation, OpenAPI openAPI, String strategy) {
        if (operation == null) return;

        Object responseBody;
        int responseStatus = 200;

        if ("error".equals(strategy)) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", "Internal Server Error");
            err.put("message", "Mock error response");
            responseBody = err;
            responseStatus = 500;
        } else if ("empty".equals(strategy)) {
            responseBody = new LinkedHashMap<>();
        } else {
            responseBody = generateResponseBody(operation, openAPI);
            responseStatus = getSuccessStatus(operation);
        }

        routes.add(new MockRoute(method, path, responseStatus, responseBody));
    }

    private Object generateResponseBody(Operation operation, OpenAPI openAPI) {
        if (operation.getResponses() == null) return new LinkedHashMap<>();

        // Prefer 200, then 201, then first 2xx
        ApiResponse apiResponse = operation.getResponses().get("200");
        if (apiResponse == null) apiResponse = operation.getResponses().get("201");
        if (apiResponse == null) {
            apiResponse = operation.getResponses().entrySet().stream()
                    .filter(e -> e.getKey().startsWith("2"))
                    .map(Map.Entry::getValue)
                    .findFirst().orElse(null);
        }
        if (apiResponse == null) return new LinkedHashMap<>();

        // Resolve $ref on the ApiResponse itself
        if (apiResponse.get$ref() != null) {
            String refName = apiResponse.get$ref().substring(apiResponse.get$ref().lastIndexOf('/') + 1);
            if (openAPI.getComponents() != null && openAPI.getComponents().getResponses() != null) {
                ApiResponse resolved = openAPI.getComponents().getResponses().get(refName);
                if (resolved != null) apiResponse = resolved;
            }
        }

        Content content = apiResponse.getContent();
        if (content == null) return new LinkedHashMap<>();

        MediaType mediaType = content.get("application/json");
        if (mediaType == null) mediaType = content.values().stream().findFirst().orElse(null);
        if (mediaType == null) return new LinkedHashMap<>();

        Schema<?> schema = mediaType.getSchema();
        if (schema == null) return new LinkedHashMap<>();

        return generateFromSchema(schema, openAPI, 0);
    }

    /** Recursively generate a fake value from a schema, resolving $refs. */
    @SuppressWarnings("unchecked")
    private Object generateFromSchema(Schema<?> schema, OpenAPI openAPI, int depth) {
        if (schema == null || depth > 5) return new LinkedHashMap<>();

        schema = resolveRef(schema, openAPI);
        if (schema == null) return new LinkedHashMap<>();

        String type = schema.getType();

        // Array type
        if ("array".equals(type) || schema instanceof ArraySchema) {
            Schema<?> items = ((ArraySchema) schema).getItems();
            items = resolveRef(items, openAPI);
            List<Object> list = new ArrayList<>();
            int count = 3;
            if (schema.getMinItems() != null) count = Math.max(count, schema.getMinItems());
            if (schema.getMaxItems() != null) count = Math.min(count, schema.getMaxItems());
            for (int i = 0; i < count; i++) {
                list.add(generateFromSchema(items, openAPI, depth + 1));
            }
            return list;
        }

        // Object type — delegate to FakeDataGenerator but fix nested $refs first
        if (schema.getProperties() != null) {
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<String, Schema> entry : ((Map<String, Schema>) schema.getProperties()).entrySet()) {
                String fieldName = entry.getKey();
                Schema<?> fieldSchema = resolveRef(entry.getValue(), openAPI);
                if (fieldSchema == null) continue;
                String fieldType = fieldSchema.getType();
                if ("object".equals(fieldType) || fieldSchema.getProperties() != null) {
                    result.put(fieldName, generateFromSchema(fieldSchema, openAPI, depth + 1));
                } else if ("array".equals(fieldType) || fieldSchema instanceof ArraySchema) {
                    result.put(fieldName, generateFromSchema(fieldSchema, openAPI, depth + 1));
                } else {
                    Object val = fakeDataGenerator.generateParameterValue(fieldName, fieldSchema);
                    if (val != null) result.put(fieldName, val);
                }
            }
            return result;
        }

        // Primitive — use FakeDataGenerator
        Map<String, Object> wrap = fakeDataGenerator.generateFromSchema(schema);
        if (!wrap.isEmpty()) return wrap;

        // Fallback for bare primitives (schema has no properties but has a type)
        if (type != null) {
            switch (type.toLowerCase()) {
                case "string":  return "string";
                case "integer": return 0;
                case "number":  return 0.0;
                case "boolean": return true;
            }
        }
        return new LinkedHashMap<>();
    }

    private int getSuccessStatus(Operation operation) {
        if (operation.getResponses() == null) return 200;
        if (operation.getResponses().containsKey("200")) return 200;
        if (operation.getResponses().containsKey("201")) return 201;
        return operation.getResponses().keySet().stream()
                .filter(k -> k.startsWith("2"))
                .mapToInt(k -> { try { return Integer.parseInt(k); } catch (Exception e) { return 200; } })
                .findFirst().orElse(200);
    }

    @SuppressWarnings("unchecked")
    private Schema<?> resolveRef(Schema<?> schema, OpenAPI openAPI) {
        if (schema == null) return null;
        String ref = schema.get$ref();
        if (ref == null) return schema;
        String name = ref.substring(ref.lastIndexOf('/') + 1);
        if (openAPI.getComponents() != null && openAPI.getComponents().getSchemas() != null) {
            return (Schema<?>) openAPI.getComponents().getSchemas().get(name);
        }
        return schema;
    }

    @SuppressWarnings("unchecked")
    private void replaceInMap(Map<String, Object> map, String placeholder, String value) {
        for (Map.Entry<String, Object> e : map.entrySet()) {
            if (e.getValue() instanceof String && ((String) e.getValue()).equals(placeholder)) {
                e.setValue(value);
            } else if (e.getValue() instanceof Map) {
                replaceInMap((Map<String, Object>) e.getValue(), placeholder, value);
            }
        }
    }

    // ======================== LOGGING ========================

    private void addLog(String method, String path, Integer status, Long durationMs) {
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("time", LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss.SSS")));
        log.put("method", method);
        log.put("path", path);
        log.put("status", status);
        log.put("duration", durationMs != null ? durationMs + "ms" : null);
        synchronized (requestLogs) {
            if (requestLogs.size() >= 500) requestLogs.pollFirst();
            requestLogs.addLast(log);
        }
    }

    // ======================== MOCK ROUTE ========================

    private static class MockRoute {
        final String method;
        final String pathPattern;       // original path, e.g. /users/{id}
        final Pattern regex;            // compiled regex for matching
        final List<String> paramNames;  // ordered path param names
        final int responseStatus;
        final Object responseBody;      // Map or List

        MockRoute(String method, String pathPattern, int responseStatus, Object responseBody) {
            this.method = method;
            this.pathPattern = pathPattern;
            this.responseStatus = responseStatus;
            this.responseBody = responseBody;

            // Build regex from path pattern
            List<String> names = new ArrayList<>();
            String regexStr = pathPattern;
            java.util.regex.Matcher m = Pattern.compile("\\{([^}]+)}").matcher(pathPattern);
            while (m.find()) names.add(m.group(1));
            regexStr = regexStr.replaceAll("\\{[^}]+}", "([^/]+)");
            this.regex = Pattern.compile("^" + regexStr + "/?$");
            this.paramNames = names;
        }

        /** Returns path params map if matches, null otherwise */
        Map<String, String> match(String path) {
            java.util.regex.Matcher m = regex.matcher(path);
            if (!m.matches()) return null;
            Map<String, String> params = new LinkedHashMap<>();
            for (int i = 0; i < paramNames.size(); i++) {
                params.put(paramNames.get(i), m.group(i + 1));
            }
            return params;
        }
    }
}
