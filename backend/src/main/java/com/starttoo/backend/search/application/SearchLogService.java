package com.starttoo.backend.search.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.starttoo.backend.common.config.MinioProperties;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.Result;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchLogService {

    private static final String PENDING_KEY = "search:logs:pending";
    private static final String SUBJECT_COUNTS = "search:subjects:query-count";
    private static final String SUBJECT_EVENT_SEQUENCE = "search:subjects:event-sequence";
    private static final String RAW_LOG_PREFIX = "search-logs/";
    private static final String SNAPSHOT_PREFIX = "search-count-snapshots/";
    private static final int BATCH_SIZE = 1_000;

    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> POP_BATCH_SCRIPT =
            new DefaultRedisScript<>("""
                    local values = redis.call('LRANGE', KEYS[1], 0, tonumber(ARGV[1]) - 1)
                    if #values > 0 then
                        redis.call('LTRIM', KEYS[1], tonumber(ARGV[1]), -1)
                    end
                    return values
                    """, List.class);

    private static final DefaultRedisScript<Long> POST_SEARCH_SCRIPT =
            new DefaultRedisScript<>("""
                    local sequence = redis.call('INCR', KEYS[3])
                    local event = string.gsub(
                        ARGV[1],
                        '"eventSequence":0',
                        '"eventSequence":' .. sequence,
                        1
                    )
                    redis.call('RPUSH', KEYS[1], event)
                    redis.call('ZINCRBY', KEYS[2], 1, ARGV[2])
                    return sequence
                    """, Long.class);

    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> SNAPSHOT_SCRIPT =
            new DefaultRedisScript<>("""
                    local result = redis.call('ZRANGE', KEYS[1], 0, -1, 'WITHSCORES')
                    table.insert(result, 1, redis.call('GET', KEYS[2]) or '0')
                    return result
                    """, List.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    public void record(Integer userSeq, String searchType, String query) {
        Map<String, Object> event = baseEvent(userSeq, searchType, query);
        enqueue(event);
    }

    public void recordPostSearch(
            Integer userSeq,
            String rawQuery,
            Integer resolvedSubjectSeq,
            String resolvedSubject
    ) {
        Map<String, Object> event = baseEvent(userSeq, "POST", rawQuery);
        if (resolvedSubjectSeq == null || resolvedSubject == null) {
            enqueue(event);
            return;
        }

        event.put("resolvedSubjectSeq", resolvedSubjectSeq);
        event.put("resolvedSubject", resolvedSubject);
        event.put("eventSequence", 0L);
        try {
            String json = objectMapper.writeValueAsString(event);
            redisTemplate.execute(
                    POST_SEARCH_SCRIPT,
                    List.of(PENDING_KEY, SUBJECT_COUNTS, SUBJECT_EVENT_SEQUENCE),
                    json,
                    resolvedSubjectSeq.toString()
            );
        } catch (JsonProcessingException | RuntimeException exception) {
            // 검색 로그와 자동완성용 집계는 부가 기능이므로 본 검색 응답은 실패시키지 않는다.
            log.warn("Post search log enqueue failed; search request continues", exception);
        }
    }

    @Scheduled(fixedDelayString = "${app.search.log-flush-delay:60000}")
    public void flushToMinio() {
        List<String> events = popBatch();
        if (events.isEmpty()) {
            return;
        }
        byte[] bytes = String.join("\n", events).concat("\n").getBytes(StandardCharsets.UTF_8);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String day = now.format(DateTimeFormatter.ISO_LOCAL_DATE);
        String timestamp = now.format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'"));
        String objectKey = RAW_LOG_PREFIX + day + "/" + timestamp + "-" + UUID.randomUUID()
                + ".jsonl";
        try {
            ensureBucketExists();
            putObject(objectKey, bytes, "application/x-ndjson");
        } catch (Exception exception) {
            List<String> restored = new ArrayList<>(events);
            Collections.reverse(restored);
            redisTemplate.opsForList().leftPushAll(PENDING_KEY, restored);
            log.warn("Search log MinIO flush failed; events returned to Redis", exception);
        }
    }

    @Scheduled(fixedDelayString = "${app.search.count-snapshot-delay:3600000}")
    public void snapshotSubjectCounts() {
        try {
            SubjectCountSnapshot snapshot = captureSnapshot();
            if (snapshot.counts().isEmpty()) {
                return;
            }
            byte[] bytes = objectMapper.writeValueAsBytes(snapshot);
            String timestamp = OffsetDateTime.now(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'"));
            String objectKey = SNAPSHOT_PREFIX + timestamp + "-" + UUID.randomUUID() + ".json";
            ensureBucketExists();
            putObject(objectKey, bytes, "application/json");
        } catch (Exception exception) {
            log.warn("Subject search count snapshot skipped", exception);
        }
    }

    /**
     * Redis 카운트가 유실됐을 때 최신 스냅샷을 적재한 뒤, 스냅샷 이후의 MinIO
     * JSONL 이벤트와 아직 flush되지 않은 Redis 이벤트를 eventSequence 기준으로 재생한다.
     */
    public void restoreSubjectCountsIfMissing() {
        Long count = redisTemplate.opsForZSet().zCard(SUBJECT_COUNTS);
        if (count != null && count > 0) {
            return;
        }
        try {
            SubjectCountSnapshot snapshot = latestSnapshot();
            Map<Integer, Double> restoredCounts = new LinkedHashMap<>();
            long snapshotSequence = 0;
            if (snapshot != null) {
                snapshotSequence = snapshot.eventSequence();
                snapshot.counts().forEach(value ->
                        restoredCounts.put(value.subjectSeq(), value.count()));
            }

            Set<Long> seenSequences = new HashSet<>();
            long maxSequence = replayMinioLogs(
                    snapshotSequence,
                    restoredCounts,
                    seenSequences
            );
            maxSequence = Math.max(
                    maxSequence,
                    replayPendingLogs(snapshotSequence, restoredCounts, seenSequences)
            );

            if (!restoredCounts.isEmpty()) {
                Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> tuples =
                        new LinkedHashSet<>();
                restoredCounts.forEach((subjectSeq, score) ->
                        tuples.add(new DefaultTypedTuple<>(subjectSeq.toString(), score)));
                redisTemplate.delete(SUBJECT_COUNTS);
                redisTemplate.opsForZSet().add(SUBJECT_COUNTS, tuples);
            }
            long sequence = Math.max(snapshotSequence, maxSequence);
            if (sequence > 0) {
                redisTemplate.opsForValue().set(
                        SUBJECT_EVENT_SEQUENCE,
                        Long.toString(sequence)
                );
            }
        } catch (Exception exception) {
            log.warn("Subject search count restore skipped", exception);
        }
    }

    private Map<String, Object> baseEvent(
            Integer userSeq,
            String searchType,
            String query
    ) {
        Map<String, Object> event = new LinkedHashMap<>();
        if (userSeq != null) {
            event.put("userSeq", userSeq);
        }
        event.put("searchType", searchType);
        event.put("rawQuery", query);
        event.put("searchedDttm", OffsetDateTime.now(ZoneOffset.UTC).toString());
        return event;
    }

    private void enqueue(Map<String, Object> event) {
        try {
            redisTemplate.opsForList().rightPush(
                    PENDING_KEY,
                    objectMapper.writeValueAsString(event)
            );
        } catch (JsonProcessingException | RuntimeException exception) {
            log.warn("Search log enqueue failed; search request continues", exception);
        }
    }

    private SubjectCountSnapshot captureSnapshot() {
        @SuppressWarnings("unchecked")
        List<Object> values = (List<Object>) redisTemplate.execute(
                SNAPSHOT_SCRIPT,
                List.of(SUBJECT_COUNTS, SUBJECT_EVENT_SEQUENCE)
        );
        if (values == null || values.isEmpty()) {
            return new SubjectCountSnapshot(
                    0,
                    OffsetDateTime.now(ZoneOffset.UTC).toString(),
                    List.of()
            );
        }
        long sequence = Long.parseLong(rawString(values.get(0)));
        List<SubjectCount> counts = new ArrayList<>();
        for (int index = 1; index + 1 < values.size(); index += 2) {
            try {
                counts.add(new SubjectCount(
                        Integer.valueOf(rawString(values.get(index))),
                        Double.parseDouble(rawString(values.get(index + 1)))
                ));
            } catch (NumberFormatException ignored) {
                // 손상된 한 항목은 제외하고 나머지 스냅샷은 유지한다.
            }
        }
        return new SubjectCountSnapshot(
                sequence,
                OffsetDateTime.now(ZoneOffset.UTC).toString(),
                counts
        );
    }

    private SubjectCountSnapshot latestSnapshot() throws Exception {
        String latestObject = null;
        for (Result<Item> result : minioClient.listObjects(ListObjectsArgs.builder()
                .bucket(minioProperties.bucket())
                .prefix(SNAPSHOT_PREFIX)
                .recursive(true)
                .build())) {
            String objectName = result.get().objectName();
            if (latestObject == null || objectName.compareTo(latestObject) > 0) {
                latestObject = objectName;
            }
        }
        if (latestObject == null) {
            return null;
        }
        try (InputStream input = minioClient.getObject(GetObjectArgs.builder()
                .bucket(minioProperties.bucket())
                .object(latestObject)
                .build())) {
            return objectMapper.readValue(input, SubjectCountSnapshot.class);
        }
    }

    private long replayMinioLogs(
            long afterSequence,
            Map<Integer, Double> counts,
            Set<Long> seenSequences
    ) throws Exception {
        long maxSequence = afterSequence;
        for (Result<Item> result : minioClient.listObjects(ListObjectsArgs.builder()
                .bucket(minioProperties.bucket())
                .prefix(RAW_LOG_PREFIX)
                .recursive(true)
                .build())) {
            String objectName = result.get().objectName();
            try (InputStream input = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(minioProperties.bucket())
                    .object(objectName)
                    .build());
                 BufferedReader reader = new BufferedReader(new InputStreamReader(
                         input,
                         StandardCharsets.UTF_8
                 ))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    maxSequence = Math.max(
                            maxSequence,
                            replayEvent(line, afterSequence, counts, seenSequences)
                    );
                }
            }
        }
        return maxSequence;
    }

    private long replayPendingLogs(
            long afterSequence,
            Map<Integer, Double> counts,
            Set<Long> seenSequences
    ) {
        List<String> pending = redisTemplate.opsForList().range(PENDING_KEY, 0, -1);
        if (pending == null) {
            return afterSequence;
        }
        long maxSequence = afterSequence;
        for (String event : pending) {
            maxSequence = Math.max(
                    maxSequence,
                    replayEvent(event, afterSequence, counts, seenSequences)
            );
        }
        return maxSequence;
    }

    private long replayEvent(
            String event,
            long afterSequence,
            Map<Integer, Double> counts,
            Set<Long> seenSequences
    ) {
        try {
            JsonNode json = objectMapper.readTree(event);
            if (!json.hasNonNull("eventSequence") || !json.hasNonNull("resolvedSubjectSeq")) {
                return afterSequence;
            }
            long sequence = json.get("eventSequence").asLong();
            if (sequence <= afterSequence || !seenSequences.add(sequence)) {
                return sequence;
            }
            int subjectSeq = json.get("resolvedSubjectSeq").asInt();
            counts.merge(subjectSeq, 1.0, Double::sum);
            return sequence;
        } catch (JsonProcessingException exception) {
            return afterSequence;
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> popBatch() {
        List<String> values = (List<String>) redisTemplate.execute(
                POP_BATCH_SCRIPT,
                List.of(PENDING_KEY),
                Integer.toString(BATCH_SIZE)
        );
        return values == null ? List.of() : values;
    }

    private void putObject(String objectKey, byte[] bytes, String contentType) throws Exception {
        minioClient.putObject(PutObjectArgs.builder()
                .bucket(minioProperties.bucket())
                .object(objectKey)
                .stream(new ByteArrayInputStream(bytes), (long) bytes.length, -1L)
                .contentType(contentType)
                .build());
    }

    private void ensureBucketExists() throws Exception {
        if (!minioClient.bucketExists(BucketExistsArgs.builder()
                .bucket(minioProperties.bucket())
                .build())) {
            minioClient.makeBucket(MakeBucketArgs.builder()
                    .bucket(minioProperties.bucket())
                    .build());
        }
    }

    private String rawString(Object value) {
        if (value instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        return value == null ? "" : value.toString();
    }

    public record SubjectCountSnapshot(
            long eventSequence,
            String generatedDttm,
            List<SubjectCount> counts
    ) {
    }

    public record SubjectCount(Integer subjectSeq, double count) {
    }
}
