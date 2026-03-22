package com.vijay.apimanager.faker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.javafaker.Faker;
import com.vijay.apimanager.service.SwaggerSchemaParser;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.parameters.Parameter;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class FakeDataGenerator {

    private final Faker faker = new Faker();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Random random = new Random();

    /**
     * Generate fake data for a schema
     */
    public Map<String, Object> generateFromSchema(Schema<?> schema) {
        if (schema == null) {
            return new HashMap<>();
        }

        Map<String, Object> result = new HashMap<>();

        if (schema.getProperties() != null) {
            for (Map.Entry<String, Schema> entry : schema.getProperties().entrySet()) {
                String fieldName = entry.getKey();
                Schema fieldSchema = entry.getValue();

                // Check if field is required
                boolean isRequired = schema.getRequired() != null &&
                        schema.getRequired().contains(fieldName);

                // Generate value
                Object value = generateValue(fieldName, fieldSchema, isRequired);
                if (value != null) {
                    result.put(fieldName, value);
                }
            }
        }

        return result;
    }

    /**
     * Generate fake data for parameters
     */
    public Map<String, String> generateParameterData(List<Parameter> parameters) {
        Map<String, String> result = new HashMap<>();

        for (Parameter param : parameters) {
            String name = param.getName();
            Schema schema = param.getSchema();
            boolean required = param.getRequired() != null && param.getRequired();

            Object value = generateValue(name, schema, required);
            if (value != null) {
                result.put(name, String.valueOf(value));
            }
        }

        return result;
    }

    /**
     * Generate value for a parameter
     */
    public Object generateParameterValue(String name, Schema<?> schema) {
        return generateValue(name, schema, true);
    }

    /**
     * Generate complete request data from endpoint schema
     */
    public Map<String, Object> generateRequestFromSchema(
            SwaggerSchemaParser.EndpointSchema endpointSchema
    ) {
        Map<String, Object> result = new HashMap<>();

        // Generate query params
        if (!endpointSchema.queryParams.isEmpty()) {
            Map<String, String> params = new HashMap<>();
            for (SwaggerSchemaParser.ParameterSchema param : endpointSchema.queryParams) {
                Object value = generateParameterValue(param.name, param.schema);
                if (value != null) {
                    params.put(param.name, String.valueOf(value));
                }
            }
            result.put("params", params);
        }

        // Generate headers
        Map<String, String> headers = new HashMap<>();

        // Add content-type if request has body
        if (endpointSchema.requestBody != null && endpointSchema.requestBody.contentType != null) {
            headers.put("Content-Type", endpointSchema.requestBody.contentType);
        }

        // Add custom headers from schema
        for (SwaggerSchemaParser.ParameterSchema header : endpointSchema.headers) {
            Object value = generateParameterValue(header.name, header.schema);
            if (value != null) {
                headers.put(header.name, String.valueOf(value));
            }
        }

        // Add auth header if required
        if (endpointSchema.authRequired && !endpointSchema.authTypes.isEmpty()) {
            String authType = endpointSchema.authTypes.get(0);
            if (authType.toLowerCase().contains("bearer")) {
                headers.put("Authorization", "Bearer " + UUID.randomUUID().toString().replace("-", ""));
            } else if (authType.toLowerCase().contains("basic")) {
                String credentials = Base64.getEncoder().encodeToString("username:password".getBytes());
                headers.put("Authorization", "Basic " + credentials);
            } else if (authType.toLowerCase().contains("api") || authType.toLowerCase().contains("key")) {
                headers.put("X-API-Key", UUID.randomUUID().toString().replace("-", ""));
            }
        }

        result.put("headers", headers);

        // Generate request body
        if (endpointSchema.requestBody != null && endpointSchema.requestBody.schema != null) {
            Map<String, Object> body = generateFromSchema(endpointSchema.requestBody.schema);
            result.put("body", body);
        }

        // Auth info
        if (endpointSchema.authRequired) {
            Map<String, Object> auth = new HashMap<>();
            auth.put("required", true);
            auth.put("types", endpointSchema.authTypes);
            result.put("auth", auth);
        }

        return result;
    }

    /**
     * Generate value based on field name and schema
     */
    private Object generateValue(String fieldName, Schema<?> schema, boolean required) {
        // Skip optional fields sometimes (30% chance)
        if (!required && random.nextInt(100) < 30) {
            return null;
        }

        // If schema has example, use it
        if (schema.getExample() != null) {
            return schema.getExample();
        }

        // If schema has enum, pick randomly
        if (schema.getEnum() != null && !schema.getEnum().isEmpty()) {
            List<?> enumValues = schema.getEnum();
            return enumValues.get(random.nextInt(enumValues.size()));
        }

        // If schema has default, use it
        if (schema.getDefault() != null) {
            return schema.getDefault();
        }

        // Generate based on type
        String type = schema.getType();
        String format = schema.getFormat();

        // Try smart generation based on field name first
        Object smartValue = generateSmartValue(fieldName, type, format);
        if (smartValue != null) {
            return smartValue;
        }

        // Fall back to type-based generation
        return generateByType(fieldName, schema, type, format);
    }

    /**
     * Smart generation based on field name patterns
     */
    private Object generateSmartValue(String fieldName, String type, String format) {
        String lowerName = fieldName.toLowerCase();

        // Email patterns
        if (lowerName.matches(".*email.*")) {
            return faker.internet().emailAddress();
        }

        // Name patterns
        if (lowerName.matches(".*firstname.*|.*first_name.*")) {
            return faker.name().firstName();
        }
        if (lowerName.matches(".*lastname.*|.*last_name.*|.*surname.*")) {
            return faker.name().lastName();
        }
        if (lowerName.matches(".*fullname.*|.*full_name.*|.*name.*")) {
            return faker.name().fullName();
        }

        // Username patterns
        if (lowerName.matches(".*username.*|.*user_name.*|.*login.*")) {
            return faker.name().username();
        }

        // Password patterns
        if (lowerName.matches(".*password.*|.*pwd.*|.*pass.*")) {
            return faker.internet().password(8, 16, true, true, true);
        }

        // Phone patterns
        if (lowerName.matches(".*phone.*|.*mobile.*|.*cell.*|.*telephone.*")) {
            return faker.phoneNumber().phoneNumber();
        }

        // Address patterns
        if (lowerName.matches(".*address.*|.*street.*")) {
            return faker.address().streetAddress();
        }
        if (lowerName.matches(".*city.*")) {
            return faker.address().city();
        }
        if (lowerName.matches(".*state.*|.*province.*")) {
            return faker.address().state();
        }
        if (lowerName.matches(".*zip.*|.*postal.*|.*postcode.*")) {
            return faker.address().zipCode();
        }
        if (lowerName.matches(".*country.*")) {
            return faker.address().country();
        }

        // Company patterns
        if (lowerName.matches(".*company.*|.*organization.*|.*org.*")) {
            return faker.company().name();
        }

        // URL patterns
        if (lowerName.matches(".*url.*|.*website.*|.*link.*")) {
            return faker.internet().url();
        }

        // Image URL patterns
        if (lowerName.matches(".*image.*|.*avatar.*|.*photo.*|.*picture.*")) {
            return faker.internet().avatar();
        }

        // Date patterns
        if (lowerName.matches(".*date.*|.*dob.*|.*birthday.*")) {
            return LocalDate.now().minusYears(random.nextInt(50) + 18).toString();
        }

        // Price/Amount patterns
        if (lowerName.matches(".*price.*|.*amount.*|.*cost.*|.*total.*|.*subtotal.*")) {
            return Math.round(faker.number().randomDouble(2, 1, 10000) * 100.0) / 100.0;
        }

        // Quantity patterns
        if (lowerName.matches(".*quantity.*|.*qty.*|.*count.*|.*stock.*")) {
            return faker.number().numberBetween(1, 1000);
        }

        // ID patterns
        if (lowerName.matches(".*id$|.*_id|.*uuid.*")) {
            return UUID.randomUUID().toString();
        }

        // Token patterns
        if (lowerName.matches(".*token.*|.*key.*|.*secret.*")) {
            return UUID.randomUUID().toString().replace("-", "");
        }

        // Description patterns
        if (lowerName.matches(".*description.*|.*desc.*|.*bio.*|.*about.*")) {
            return faker.lorem().paragraph();
        }

        // Title patterns
        if (lowerName.matches(".*title.*|.*heading.*|.*subject.*")) {
            return faker.lorem().sentence();
        }

        // Status patterns
        if (lowerName.matches(".*status.*")) {
            return faker.options().option("active", "inactive", "pending", "completed");
        }

        // Role patterns
        if (lowerName.matches(".*role.*")) {
            return faker.options().option("admin", "user", "moderator", "guest");
        }

        // Gender patterns
        if (lowerName.matches(".*gender.*|.*sex.*")) {
            return faker.options().option("male", "female", "other", "prefer_not_to_say");
        }

        // Color patterns
        if (lowerName.matches(".*color.*|.*colour.*")) {
            return faker.color().name();
        }

        // ISBN patterns
        if (lowerName.matches(".*isbn.*")) {
            return faker.code().isbn13();
        }

        // Credit card patterns
        if (lowerName.matches(".*card.*number.*|.*creditcard.*|.*credit_card.*")) {
            return faker.business().creditCardNumber();
        }

        // Credit card type
        if (lowerName.matches(".*card.*type.*")) {
            return faker.options().option("Visa", "MasterCard", "American Express", "Discover");
        }

        // CVV
        if (lowerName.matches(".*cvv.*|.*cvc.*|.*security.*code.*")) {
            return faker.number().digits(3);
        }

        // Expiry
        if (lowerName.matches(".*expiry.*|.*expiration.*")) {
            return String.format("%02d/%02d",
                    random.nextInt(12) + 1,
                    (LocalDate.now().getYear() + random.nextInt(5)) % 100);
        }

        // IBAN
        if (lowerName.matches(".*iban.*")) {
            return faker.finance().iban();
        }

        // BIC/SWIFT
        if (lowerName.matches(".*bic.*|.*swift.*")) {
            return faker.finance().bic();
        }

        // Currency
        if (lowerName.matches(".*currency.*")) {
            return faker.currency().code();
        }

        // Latitude/Longitude
        if (lowerName.matches(".*latitude.*|.*lat.*")) {
            return faker.address().latitude();
        }
        if (lowerName.matches(".*longitude.*|.*lng.*|.*lon.*")) {
            return faker.address().longitude();
        }

        // Domain
        if (lowerName.matches(".*domain.*")) {
            return faker.internet().domainName();
        }

        // IP Address
        if (lowerName.matches(".*ip.*address.*|.*ipaddress.*")) {
            return faker.internet().ipV4Address();
        }

        // MAC Address
        if (lowerName.matches(".*mac.*address.*|.*macaddress.*")) {
            return faker.internet().macAddress();
        }

        // Timezone
        if (lowerName.matches(".*timezone.*|.*time.*zone.*")) {
            return faker.options().option("America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo");
        }

        // Language
        if (lowerName.matches(".*language.*|.*lang.*")) {
            return faker.options().option("en", "es", "fr", "de", "ja", "zh");
        }

        // Age
        if (lowerName.matches(".*age.*")) {
            return faker.number().numberBetween(18, 80);
        }

        // Rating
        if (lowerName.matches(".*rating.*|.*score.*")) {
            return faker.number().randomDouble(1, 1, 5);
        }

        // Percentage
        if (lowerName.matches(".*percent.*|.*percentage.*")) {
            return faker.number().numberBetween(0, 100);
        }

        // Duration (in minutes)
        if (lowerName.matches(".*duration.*")) {
            return faker.number().numberBetween(1, 180);
        }

        // Weight
        if (lowerName.matches(".*weight.*")) {
            return faker.number().randomDouble(2, 1, 500);
        }

        // Height
        if (lowerName.matches(".*height.*")) {
            return faker.number().randomDouble(2, 50, 250);
        }

        // SKU
        if (lowerName.matches(".*sku.*|.*product.*code.*")) {
            return "SKU-" + faker.code().isbn10();
        }

        // Barcode
        if (lowerName.matches(".*barcode.*|.*upc.*|.*ean.*")) {
            return faker.code().ean13();
        }

        return null;
    }

    /**
     * Generate by OpenAPI type
     */
    private Object generateByType(String fieldName, Schema<?> schema, String type, String format) {
        if (type == null) {
            return generateString(schema);
        }

        switch (type.toLowerCase()) {
            case "string":
                return generateString(schema, format);

            case "integer":
            case "number":
                return generateNumber(schema, type, format);

            case "boolean":
                return faker.bool().bool();

            case "array":
                return generateArray(fieldName, schema);

            case "object":
                if (schema instanceof ObjectSchema || schema.getProperties() != null) {
                    return generateFromSchema(schema);
                }
                return new HashMap<>();

            default:
                return generateString(schema);
        }
    }

    /**
     * Generate string with format
     */
    private String generateString(Schema<?> schema) {
        return generateString(schema, null);
    }

    private String generateString(Schema<?> schema, String format) {
        // Handle format
        if (format != null) {
            switch (format.toLowerCase()) {
                case "email":
                    return faker.internet().emailAddress();

                case "uuid":
                    return UUID.randomUUID().toString();

                case "uri":
                case "url":
                    return faker.internet().url();

                case "date":
                    return LocalDate.now().minusDays(random.nextInt(365)).toString();

                case "date-time":
                    return OffsetDateTime.now().minusHours(random.nextInt(1000))
                            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

                case "time":
                    return LocalTime.now().format(DateTimeFormatter.ISO_TIME);

                case "password":
                    return faker.internet().password(8, 16, true, true, true);

                case "byte":
                case "binary":
                    return Base64.getEncoder().encodeToString(
                            faker.lorem().characters(20).getBytes()
                    );

                case "ipv4":
                    return faker.internet().ipV4Address();

                case "ipv6":
                    return faker.internet().ipV6Address();

                case "hostname":
                    return faker.internet().domainName();
            }
        }

        // Handle constraints
        Integer minLength = schema.getMinLength();
        Integer maxLength = schema.getMaxLength();
        String pattern = schema.getPattern();

        // Generate with pattern
        if (pattern != null) {
            return generateFromPattern(pattern);
        }

        // Generate with length constraints
        int length = 10; // default
        if (minLength != null && maxLength != null) {
            length = minLength + random.nextInt(maxLength - minLength + 1);
        } else if (minLength != null) {
            length = minLength + random.nextInt(20);
        } else if (maxLength != null) {
            length = Math.min(maxLength, random.nextInt(maxLength) + 1);
        }

        return faker.lorem().characters(length);
    }

    /**
     * Generate number
     */
    private Number generateNumber(Schema<?> schema, String type, String format) {
        Number minimum = (Number) schema.getMinimum();
        Number maximum = (Number) schema.getMaximum();

        double min = minimum != null ? minimum.doubleValue() : 0;
        double max = maximum != null ? maximum.doubleValue() : 10000;

        // Handle format
        boolean isInteger = "integer".equals(type) || "int32".equals(format) || "int64".equals(format);
        boolean isFloat = "float".equals(format);
        boolean isDouble = "double".equals(format);

        if (isInteger) {
            return (long) (min + random.nextDouble() * (max - min));
        } else if (isFloat) {
            return (float) (min + random.nextDouble() * (max - min));
        } else {
            return min + random.nextDouble() * (max - min);
        }
    }

    /**
     * Generate array
     */
    private List<Object> generateArray(String fieldName, Schema<?> schema) {
        ArraySchema arraySchema = (ArraySchema) schema;
        Schema itemsSchema = arraySchema.getItems();

        Integer minItems = schema.getMinItems();
        Integer maxItems = schema.getMaxItems();

        int count = 3; // default
        if (minItems != null && maxItems != null) {
            count = minItems + random.nextInt(maxItems - minItems + 1);
        } else if (minItems != null) {
            count = minItems + random.nextInt(5);
        } else if (maxItems != null) {
            count = Math.min(maxItems, random.nextInt(5) + 1);
        }

        List<Object> result = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Object item = generateValue(fieldName + "[" + i + "]", itemsSchema, true);
            result.add(item);
        }

        return result;
    }

    /**
     * Generate from regex pattern (simplified)
     */
    private String generateFromPattern(String pattern) {
        // Simplified pattern generation
        // For complex patterns, consider using: https://github.com/mifmif/Generex

        // Handle common patterns
        if (pattern.contains("\\d")) {
            return pattern.replaceAll("\\\\d", String.valueOf(random.nextInt(10)));
        }
        if (pattern.contains("[0-9]")) {
            return pattern.replaceAll("\\[0-9\\]", String.valueOf(random.nextInt(10)));
        }
        if (pattern.contains("[a-z]")) {
            return pattern.replaceAll("\\[a-z\\]", String.valueOf((char) ('a' + random.nextInt(26))));
        }
        if (pattern.contains("[A-Z]")) {
            return pattern.replaceAll("\\[A-Z\\]", String.valueOf((char) ('A' + random.nextInt(26))));
        }

        // Fallback
        return faker.lorem().characters(10);
    }



    /**
     * Convert to JSON string
     */
    public String toJSON(Map<String, Object> data) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
        } catch (Exception e) {
            return "{}";
        }
    }
}