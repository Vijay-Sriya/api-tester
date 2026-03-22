package com.vijay.apimanager.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vijay.apimanager.model.TestCase;
import com.vijay.apimanager.repository.TestCaseRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class DataDrivenService {

    @Autowired
    private TestCaseRepository testCaseRepository;

    @Autowired
    private TestCaseService testCaseService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Run all rows in the uploaded CSV/Excel against the given test case */
    public List<Map<String, Object>> run(Long testCaseId, MultipartFile file) throws Exception {
        TestCase testCase = testCaseRepository.findById(testCaseId)
                .orElseThrow(() -> new RuntimeException("Test case not found: " + testCaseId));

        List<DataRow> rows = parseFile(file);
        List<Map<String, Object>> results = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            DataRow row = rows.get(i);
            Map<String, Object> rowResult = testCaseService.runRow(
                    testCase, row.variables, row.expectedStatus, row.assertions);
            rowResult.put("row", i + 1);
            rowResult.put("variables", row.variables);
            results.add(rowResult);
        }

        return results;
    }

    /** Generate a sample CSV template for the given test case */
    public String generateTemplate(Long testCaseId) throws Exception {
        TestCase tc = testCaseRepository.findById(testCaseId)
                .orElseThrow(() -> new RuntimeException("Test case not found: " + testCaseId));

        List<String> headers = new ArrayList<>();

        // Extract path param names from endpoint
        if (tc.getEndpoint() != null) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\{([^}]+)\\}").matcher(tc.getEndpoint());
            while (m.find()) headers.add("var." + m.group(1));
        }

        // Extract top-level keys from body if it's JSON
        if (tc.getBody() != null && !tc.getBody().isBlank()) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> bodyMap = objectMapper.readValue(tc.getBody(), Map.class);
                for (String key : bodyMap.keySet()) headers.add("var." + key);
            } catch (Exception ignored) {}
        }

        if (headers.isEmpty()) headers.add("var.exampleVar");

        headers.add("expected_status");
        headers.add("assert.body.fieldName:equals");
        headers.add("assert.header.content-type:contains");

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", headers)).append("\n");

        // Example row
        List<String> exampleRow = new ArrayList<>();
        for (String h : headers) {
            if (h.equals("expected_status")) exampleRow.add("200");
            else if (h.startsWith("assert.body.")) exampleRow.add("expectedValue");
            else if (h.startsWith("assert.header.")) exampleRow.add("application/json");
            else exampleRow.add("value1");
        }
        sb.append(String.join(",", exampleRow)).append("\n");

        return sb.toString();
    }

    // ─── File Parsing ─────────────────────────────────────────────────────────

    private List<DataRow> parseFile(MultipartFile file) throws Exception {
        String filename = Objects.requireNonNullElse(file.getOriginalFilename(), "").toLowerCase();
        if (filename.endsWith(".csv") || filename.endsWith(".txt")) {
            return parseCsv(file.getInputStream());
        } else {
            return parseExcel(file.getInputStream());
        }
    }

    private List<DataRow> parseCsv(InputStream is) throws Exception {
        try (CSVParser parser = CSVParser.parse(is, StandardCharsets.UTF_8,
                CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build())) {
            List<String> headers = new ArrayList<>(parser.getHeaderNames());
            List<DataRow> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                final CSVRecord rec = record;
                rows.add(buildRow(headers, i -> rec.get(i)));
            }
            return rows;
        }
    }

    private List<DataRow> parseExcel(InputStream is) throws Exception {
        try (Workbook workbook = WorkbookFactory.create(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) return List.of();

            List<String> headers = new ArrayList<>();
            for (Cell cell : headerRow) {
                headers.add(cell.getStringCellValue().trim());
            }

            List<DataRow> rows = new ArrayList<>();
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                boolean allBlank = true;
                for (int c = 0; c < headers.size(); c++) {
                    Cell cell = row.getCell(c);
                    if (cell != null && cell.getCellType() != CellType.BLANK) { allBlank = false; break; }
                }
                if (allBlank) continue;
                final Row finalRow = row;
                rows.add(buildRow(headers, i -> getCellString(finalRow.getCell(i))));
            }
            return rows;
        }
    }

    @FunctionalInterface
    private interface CellValueGetter {
        String get(int columnIndex);
    }

    private DataRow buildRow(List<String> headers, CellValueGetter getter) {
        Map<String, String> variables = new LinkedHashMap<>();
        Integer expectedStatus = null;
        List<Map<String, Object>> assertions = new ArrayList<>();

        for (int i = 0; i < headers.size(); i++) {
            String header = headers.get(i);
            String value  = getter.get(i);
            if (value == null) value = "";

            if (header.startsWith("var.")) {
                variables.put(header.substring(4), value);
            } else if (header.equalsIgnoreCase("expected_status") && !value.isBlank()) {
                try { expectedStatus = Integer.parseInt(value.trim()); } catch (Exception ignored) {}
            } else if (header.startsWith("assert.body.") || header.startsWith("assert.header.")) {
                if (!value.isBlank()) {
                    assertions.add(buildAssertionFromColumn(header, value));
                }
            }
        }

        return new DataRow(variables, expectedStatus, assertions);
    }

    private Map<String, Object> buildAssertionFromColumn(String header, String value) {
        // header: assert.body.<field>[:<operator>] or assert.header.<name>[:<operator>]
        String withoutPrefix;
        String defaultOp;
        if (header.startsWith("assert.body.")) {
            withoutPrefix = header.substring("assert.body.".length());
            defaultOp = "equals";
        } else {
            // assert.header.*
            withoutPrefix = "header." + header.substring("assert.header.".length());
            defaultOp = "contains";
        }

        String field;
        String operator;
        int colonIdx = withoutPrefix.lastIndexOf(':');
        if (colonIdx >= 0) {
            field    = withoutPrefix.substring(0, colonIdx);
            operator = withoutPrefix.substring(colonIdx + 1);
        } else {
            field    = withoutPrefix;
            operator = defaultOp;
        }

        Map<String, Object> a = new LinkedHashMap<>();
        a.put("field",    field);
        a.put("operator", operator);
        a.put("value",    value);
        return a;
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try { yield String.valueOf(cell.getNumericCellValue()); } catch (Exception e) {
                    try { yield cell.getStringCellValue(); } catch (Exception e2) { yield ""; }
                }
            }
            default -> "";
        };
    }

    // ─── Inner DTO ────────────────────────────────────────────────────────────

    private static class DataRow {
        final Map<String, String>       variables;
        final Integer                   expectedStatus;
        final List<Map<String, Object>> assertions;

        DataRow(Map<String, String> variables, Integer expectedStatus, List<Map<String, Object>> assertions) {
            this.variables      = variables;
            this.expectedStatus = expectedStatus;
            this.assertions     = assertions;
        }
    }
}
