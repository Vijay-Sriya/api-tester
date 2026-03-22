package com.vijay.apimanager.service;

import com.github.javafaker.Faker;
import com.vijay.apimanager.model.Secret;
import com.vijay.apimanager.repository.SecretRepository;
import com.vijay.apimanager.service.CertificateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class LoadTestService {

    private final Faker faker = new Faker();
    private final Pattern fakePlaceholder = Pattern.compile("\\{\\{fake\\.([^}]+)\\}\\}");

    @Autowired
    private SecretRepository secretRepository;

    @Autowired
    private CertificateService certificateService;

    // ── Hard safety limits ──────────────────────────────────────
    private static final int    MAX_VUS              = 50;
    private static final long   MAX_DURATION_MS      = 5 * 60_000L;  // 5 minutes
    private static final long   MAX_RAMPUP_MS        = 2 * 60_000L;  // 2 minutes
    private static final long   MIN_THINK_TIME_MS    = 50;           // min pause between requests per VU
    private static final int    MAX_RESPONSE_SAMPLES = 50_000;       // cap in-memory list size
    private static final int    MAX_CONCURRENT_TESTS = 1;            // only one running at a time
    private static final long   EXECUTION_TTL_MS     = 60 * 60_000L; // evict after 1 hour

    // In-memory store for active/completed executions
    private final Map<String, LoadTestExecution> executions = new ConcurrentHashMap<>();

    // ======================== PUBLIC API ========================

    public String start(Map<String, Object> config) {
        // Evict stale executions first
        long cutoff = System.currentTimeMillis() - EXECUTION_TTL_MS;
        executions.entrySet().removeIf(e ->
            !"running".equals(e.getValue().status) && e.getValue().startTime < cutoff
        );

        // Enforce max concurrent running tests
        long running = executions.values().stream()
            .filter(e -> "running".equals(e.status)).count();
        if (running >= MAX_CONCURRENT_TESTS) {
            throw new IllegalStateException(
                "A load test is already running. Stop it before starting a new one."
            );
        }

        String testId = UUID.randomUUID().toString().substring(0, 8);
        LoadTestExecution exec = new LoadTestExecution(testId);
        executions.put(testId, exec);

        Thread t = new Thread(() -> runTest(config, exec));
        t.setDaemon(true);
        t.start();

        return testId;
    }

    public Map<String, Object> getStatus(String testId) {
        LoadTestExecution exec = executions.get(testId);
        if (exec == null) return Map.of("error", "Test not found");
        return exec.toStatusMap();
    }

    public Map<String, Object> getResults(String testId) {
        LoadTestExecution exec = executions.get(testId);
        if (exec == null) return Map.of("error", "Test not found");
        return exec.toResultMap();
    }

    public boolean stop(String testId) {
        LoadTestExecution exec = executions.get(testId);
        if (exec == null) return false;
        exec.cancelled = true;
        return true;
    }

    // ======================== TEST RUNNER ========================

    private void runTest(Map<String, Object> config, LoadTestExecution exec) {
        try {
            // Apply hard caps — silently clamp so the test still runs
            int vus         = Math.min(intVal(config, "virtualUsers", 10), MAX_VUS);
            long durationMs = Math.min(parseTime(strVal(config, "duration", "30s")), MAX_DURATION_MS);
            long rampUpMs   = Math.min(parseTime(strVal(config, "rampUp", "0s")), MAX_RAMPUP_MS);
            long thinkTimeMs = Math.max(MIN_THINK_TIME_MS, intVal(config, "thinkTime", (int) MIN_THINK_TIME_MS));
            String url      = strVal(config, "url", "");
            String method   = strVal(config, "method", "GET").toUpperCase();
            String headers  = strVal(config, "headers", "{}");
            String body     = strVal(config, "body", "");

            if (url.isEmpty()) { exec.fail("Target URL is required"); return; }

            exec.status        = "running";
            exec.startTime     = System.currentTimeMillis();
            exec.expectedEndMs = exec.startTime + durationMs;
            exec.config        = config;
            // Store the effective (clamped) limits so the frontend can show them
            exec.effectiveVus      = vus;
            exec.effectiveDuration = durationMs;

            // Parse static headers once
            Map<String, String> parsedHeaders = parseHeaders(headers);

            // Use cert-aware client if certId is specified in config
            HttpClient httpClient;
            Object certIdVal = config.get("certId");
            if (certIdVal != null && !certIdVal.toString().isEmpty()) {
                Long certId = Long.parseLong(certIdVal.toString());
                httpClient = secretRepository.findById(certId)
                    .map(certificateService::buildJavaHttpClient)
                    .orElseGet(() -> HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
            } else {
                httpClient = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(10))
                        .build();
            }

            ExecutorService pool = Executors.newFixedThreadPool(vus);
            List<Future<?>> futures = new ArrayList<>();

            for (int i = 0; i < vus; i++) {
                final int vuIdx = i;
                futures.add(pool.submit(() -> {
                    // Ramp-up: stagger start times
                    if (rampUpMs > 0 && vus > 1) {
                        try { Thread.sleep((vuIdx * rampUpMs) / vus); } catch (InterruptedException ignored) {}
                    }
                    long end = exec.startTime + durationMs;
                    while (System.currentTimeMillis() < end && !exec.cancelled) {
                        long reqStart = System.currentTimeMillis();
                        try {
                            String resolvedUrl  = substituteFakeData(url);
                            String resolvedBody = substituteFakeData(body);
                            HttpRequest req = buildRequest(resolvedUrl, method, parsedHeaders, resolvedBody);
                            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                            exec.record(System.currentTimeMillis() - reqStart, resp.statusCode());
                        } catch (Exception e) {
                            exec.recordError(System.currentTimeMillis() - reqStart);
                        }
                        // Think time — prevents hot-loop saturation
                        long elapsed = System.currentTimeMillis() - reqStart;
                        long pause   = thinkTimeMs - elapsed;
                        if (pause > 0) {
                            try { Thread.sleep(pause); } catch (InterruptedException ignored) {}
                        }
                    }
                }));
            }

            pool.shutdown();
            pool.awaitTermination(durationMs + 60_000, TimeUnit.MILLISECONDS);
            exec.complete();

        } catch (Exception e) {
            exec.fail(e.getMessage());
        }
    }

    private HttpRequest buildRequest(String url, String method, Map<String, String> headers, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(new URI(url))
                .timeout(Duration.ofSeconds(30));

        headers.forEach(builder::header);
        if (!headers.containsKey("Content-Type") && !body.isEmpty()) {
            builder.header("Content-Type", "application/json");
        }

        HttpRequest.BodyPublisher publisher = body.isEmpty()
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body);

        builder.method(method, switch (method) {
            case "GET", "DELETE", "HEAD" -> HttpRequest.BodyPublishers.noBody();
            default -> publisher;
        });

        return builder.build();
    }

    // ======================== FAKE DATA SUBSTITUTION ========================

    public String substituteFakeData(String text) {
        if (text == null || !text.contains("{{fake.")) return text;
        Matcher m = fakePlaceholder.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement(fakeValue(m.group(1))));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String fakeValue(String field) {
        return switch (field.toLowerCase()) {
            case "name"        -> faker.name().fullName();
            case "firstname"   -> faker.name().firstName();
            case "lastname"    -> faker.name().lastName();
            case "email"       -> faker.internet().emailAddress();
            case "phone"       -> faker.phoneNumber().phoneNumber();
            case "uuid"        -> UUID.randomUUID().toString();
            case "number"      -> String.valueOf(faker.number().numberBetween(1, 100000));
            case "decimal"     -> String.format("%.2f", faker.number().randomDouble(2, 1, 10000));
            case "boolean"     -> String.valueOf(faker.bool().bool());
            case "word"        -> faker.lorem().word();
            case "sentence"    -> faker.lorem().sentence();
            case "paragraph"   -> faker.lorem().paragraph();
            case "address"     -> faker.address().streetAddress();
            case "city"        -> faker.address().city();
            case "country"     -> faker.address().country();
            case "zipcode"     -> faker.address().zipCode();
            case "url"         -> faker.internet().url();
            case "username"    -> faker.name().username();
            case "password"    -> faker.internet().password(8, 16);
            case "company"     -> faker.company().name();
            case "date"        -> LocalDate.now().minusDays(faker.number().numberBetween(0, 365)).toString();
            case "timestamp"   -> String.valueOf(System.currentTimeMillis());
            case "color"       -> faker.color().name();
            case "ip"          -> faker.internet().ipV4Address();
            default            -> faker.lorem().word();
        };
    }

    // ======================== HELPERS ========================

    private long parseTime(String time) {
        if (time == null || time.isEmpty()) return 30_000;
        time = time.trim().toLowerCase();
        if (time.endsWith("ms")) return Long.parseLong(time.replace("ms", "").trim());
        if (time.endsWith("m"))  return Long.parseLong(time.replace("m", "").trim()) * 60_000;
        if (time.endsWith("s"))  return Long.parseLong(time.replace("s", "").trim()) * 1_000;
        try { return Long.parseLong(time) * 1_000; } catch (Exception e) { return 30_000; }
    }

    private Map<String, String> parseHeaders(String headersJson) {
        try {
            Map<?, ?> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(headersJson, Map.class);
            Map<String, String> result = new LinkedHashMap<>();
            map.forEach((k, v) -> result.put(String.valueOf(k), String.valueOf(v)));
            return result;
        } catch (Exception e) { return new LinkedHashMap<>(); }
    }

    private int intVal(Map<String, Object> m, String key, int def) {
        Object v = m.get(key);
        if (v == null) return def;
        try { return Integer.parseInt(String.valueOf(v)); } catch (Exception e) { return def; }
    }

    private String strVal(Map<String, Object> m, String key, String def) {
        Object v = m.get(key);
        return v != null ? String.valueOf(v) : def;
    }

    // ======================== EXECUTION STATE ========================

    public static class LoadTestExecution {
        public final String testId;
        public volatile String status = "pending";
        public volatile boolean cancelled = false;
        public volatile long startTime;
        public volatile long expectedEndMs;
        public volatile String errorMsg;
        public Map<String, Object> config;
        public volatile int  effectiveVus;
        public volatile long effectiveDuration;

        final List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());
        final AtomicInteger total       = new AtomicInteger();
        final AtomicInteger success     = new AtomicInteger();
        final AtomicInteger failed      = new AtomicInteger();

        // Per-second throughput (for chart)
        final Map<Long, Integer> perSecond = new ConcurrentHashMap<>();

        LoadTestExecution(String testId) { this.testId = testId; }

        void record(long rt, int statusCode) {
            // Cap sample storage to avoid memory exhaustion on long/high-RPS runs
            if (responseTimes.size() < MAX_RESPONSE_SAMPLES) responseTimes.add(rt);
            total.incrementAndGet();
            if (statusCode >= 200 && statusCode < 300) success.incrementAndGet();
            else failed.incrementAndGet();
            long sec = (System.currentTimeMillis() - startTime) / 1000;
            perSecond.merge(sec, 1, Integer::sum);
        }

        void recordError(long rt) {
            if (responseTimes.size() < MAX_RESPONSE_SAMPLES) responseTimes.add(rt);
            total.incrementAndGet();
            failed.incrementAndGet();
        }

        void complete() { status = "completed"; }
        void fail(String msg) { status = "error"; errorMsg = msg; }

        int progress() {
            if (expectedEndMs <= startTime) return 0;
            long elapsed = System.currentTimeMillis() - startTime;
            long total   = expectedEndMs - startTime;
            return (int) Math.min(100, elapsed * 100 / total);
        }

        Map<String, Object> calcStats() {
            int n = total.get();
            if (n == 0) return new LinkedHashMap<>();
            List<Long> sorted = new ArrayList<>(responseTimes);
            Collections.sort(sorted);
            int sz = sorted.size();
            long durationMs = Math.max(1, System.currentTimeMillis() - startTime);
            double rps = n / (durationMs / 1000.0);
            double avgRt = sorted.stream().mapToLong(Long::longValue).average().orElse(0);

            Map<String, Object> s = new LinkedHashMap<>();
            s.put("totalRequests",      n);
            s.put("successfulRequests", success.get());
            s.put("failedRequests",     failed.get());
            s.put("avgResponseTime",    String.format("%.0fms", avgRt));
            s.put("minResponseTime",    sorted.get(0) + "ms");
            s.put("p50",                sorted.get((int)(sz * 0.50)) + "ms");
            s.put("p95",                sorted.get(Math.min(sz - 1, (int)(sz * 0.95))) + "ms");
            s.put("p99",                sorted.get(Math.min(sz - 1, (int)(sz * 0.99))) + "ms");
            s.put("maxResponseTime",    sorted.get(sz - 1) + "ms");
            s.put("rps",                String.format("%.1f", rps));
            s.put("successRate",        String.format("%.1f%%", success.get() * 100.0 / n));
            s.put("errorRate",          String.format("%.1f%%", failed.get() * 100.0 / n));
            s.put("durationMs",         durationMs);
            // Distribution buckets (for chart)
            s.put("buckets", buildBuckets(sorted));
            return s;
        }

        private Map<String, Integer> buildBuckets(List<Long> sorted) {
            Map<String, Integer> b = new LinkedHashMap<>();
            b.put("0-100ms",   0); b.put("100-300ms", 0); b.put("300-500ms", 0);
            b.put("500ms-1s",  0); b.put("1s-2s",     0); b.put(">2s",       0);
            for (long rt : sorted) {
                if      (rt < 100)  b.merge("0-100ms",   1, Integer::sum);
                else if (rt < 300)  b.merge("100-300ms", 1, Integer::sum);
                else if (rt < 500)  b.merge("300-500ms", 1, Integer::sum);
                else if (rt < 1000) b.merge("500ms-1s",  1, Integer::sum);
                else if (rt < 2000) b.merge("1s-2s",     1, Integer::sum);
                else                b.merge(">2s",        1, Integer::sum);
            }
            return b;
        }

        Map<String, Object> toStatusMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("testId",   testId);
            m.put("status",   status);
            m.put("progress", progress());
            m.put("elapsed",  startTime > 0 ? (System.currentTimeMillis() - startTime) + "ms" : null);
            m.put("totalSoFar", total.get());
            m.put("effectiveVus", effectiveVus);
            m.put("effectiveDurationMs", effectiveDuration);
            if ("error".equals(status)) m.put("error", errorMsg);
            return m;
        }

        Map<String, Object> toResultMap() {
            Map<String, Object> m = toStatusMap();
            m.put("stats",  calcStats());
            m.put("config", config);
            return m;
        }
    }
}
