package com.vijay.apimanager.service;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.parser.OpenAPIV3Parser;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SwaggerSchemaParser {

    /**
     * Parse endpoint schema from Swagger
     */
    public EndpointSchema parseEndpointSchema(String swaggerFilePath, String path, String method) {
        OpenAPI openAPI = new OpenAPIV3Parser().read(swaggerFilePath);

        if (openAPI == null || openAPI.getPaths() == null) {
            return new EndpointSchema();
        }

        PathItem pathItem = openAPI.getPaths().get(path);
        if (pathItem == null) {
            return new EndpointSchema();
        }

        Operation operation = getOperation(pathItem, method);
        if (operation == null) {
            return new EndpointSchema();
        }

        EndpointSchema schema = new EndpointSchema();

        // Parse parameters
        if (operation.getParameters() != null) {
            for (Parameter param : operation.getParameters()) {
                ParameterSchema paramSchema = parseParameter(param);

                switch (param.getIn()) {
                    case "query":
                        schema.queryParams.add(paramSchema);
                        break;
                    case "header":
                        schema.headers.add(paramSchema);
                        break;
                    case "path":
                        schema.pathParams.add(paramSchema);
                        break;
                }
            }
        }

        // Parse request body
        if (operation.getRequestBody() != null) {
            schema.requestBody = parseRequestBody(operation.getRequestBody());
        }

        // Parse security (auth)
        if (operation.getSecurity() != null && !operation.getSecurity().isEmpty()) {
            schema.authRequired = true;
            schema.authTypes = extractAuthTypes(operation.getSecurity());
        } else if (openAPI.getSecurity() != null && !openAPI.getSecurity().isEmpty()) {
            schema.authRequired = true;
            schema.authTypes = extractAuthTypes(openAPI.getSecurity());
        }

        return schema;
    }

    /**
     * Parse single parameter
     */
    private ParameterSchema parseParameter(Parameter param) {
        ParameterSchema paramSchema = new ParameterSchema();
        paramSchema.name = param.getName();
        paramSchema.description = param.getDescription();
        paramSchema.required = param.getRequired() != null && param.getRequired();
        paramSchema.schema = param.getSchema();
        paramSchema.example = param.getExample();

        return paramSchema;
    }

    /**
     * Parse request body
     */
    private RequestBodySchema parseRequestBody(RequestBody requestBody) {
        RequestBodySchema bodySchema = new RequestBodySchema();
        bodySchema.required = requestBody.getRequired() != null && requestBody.getRequired();
        bodySchema.description = requestBody.getDescription();

        Content content = requestBody.getContent();
        if (content != null) {
            // Try JSON first
            MediaType jsonMediaType = content.get("application/json");
            if (jsonMediaType != null) {
                bodySchema.contentType = "application/json";
                bodySchema.schema = jsonMediaType.getSchema();
                bodySchema.example = jsonMediaType.getExample();
            } else {
                // Try other content types
                Map.Entry<String, MediaType> first = content.entrySet().stream().findFirst().orElse(null);
                if (first != null) {
                    bodySchema.contentType = first.getKey();
                    bodySchema.schema = first.getValue().getSchema();
                    bodySchema.example = first.getValue().getExample();
                }
            }
        }

        return bodySchema;
    }

    /**
     * Extract auth types from security requirements
     */
    private List<String> extractAuthTypes(List<SecurityRequirement> security) {
        List<String> authTypes = new ArrayList<>();

        for (SecurityRequirement securityReq : security) {
            authTypes.addAll(securityReq.keySet());
        }

        return authTypes;
    }

    /**
     * Get operation by method
     */
    private Operation getOperation(PathItem pathItem, String method) {
        return switch (method.toUpperCase()) {
            case "GET" -> pathItem.getGet();
            case "POST" -> pathItem.getPost();
            case "PUT" -> pathItem.getPut();
            case "DELETE" -> pathItem.getDelete();
            case "PATCH" -> pathItem.getPatch();
            case "HEAD" -> pathItem.getHead();
            case "OPTIONS" -> pathItem.getOptions();
            default -> null;
        };
    }

    // Inner classes for schema representation

    public static class EndpointSchema {
        public List<ParameterSchema> queryParams = new ArrayList<>();
        public List<ParameterSchema> headers = new ArrayList<>();
        public List<ParameterSchema> pathParams = new ArrayList<>();
        public RequestBodySchema requestBody;
        public boolean authRequired = false;
        public List<String> authTypes = new ArrayList<>();
    }

    public static class ParameterSchema {
        public String name;
        public String description;
        public boolean required;
        public Schema schema;
        public Object example;
    }

    public static class RequestBodySchema {
        public String contentType;
        public boolean required;
        public String description;
        public Schema schema;
        public Object example;
    }
}