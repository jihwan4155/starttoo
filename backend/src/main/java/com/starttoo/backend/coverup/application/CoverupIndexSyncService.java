package com.starttoo.backend.coverup.application;

import com.starttoo.backend.coverup.config.CoverupProperties;
import com.starttoo.backend.media.application.MediaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * DB 상태와 검색 엔진 색인을 주기적으로 맞춘다.
 *
 * <p>is_deleted 가 tattoos·tattoo_designs·images 세 곳에 흩어져 있어서 삭제 훅을 하나라도
 * 빠뜨리면 삭제된 도안이 검색에 계속 잡힌다. 훅에 의존하지 않고 이 스캔을 진실 공급원으로 둔다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CoverupIndexSyncService {

    /** 엔진의 COVERUP_MAX_IMAGE_BODY 와 같은 값. 넘으면 어차피 400 이라 올리지 않는다. */
    private static final int MAX_IMAGE_BASE64_BYTES = 10 * 1024 * 1024;

    /**
     * (a) 색인 누락 복구 대상.
     *
     * <p>tattoos.is_deleted 까지 보는 것은 의도다. 이 조건이 없으면 삭제된 타투의 도안을
     * (a)가 색인하고 (b)가 지우는 일을 매 스캔마다 반복한다.
     */
    private static final String MISSING_SQL = """
            SELECT td.tattoo_seq,
                   i.object_key
              FROM tattoo_designs td
              JOIN tattoos t ON t.tattoo_seq = td.tattoo_seq
              JOIN images i ON i.image_seq = td.image_seq
             WHERE td.indexed = FALSE
               AND td.is_deleted = FALSE
               AND t.is_deleted = FALSE
               AND i.is_deleted = FALSE
             ORDER BY td.tattoo_seq
             LIMIT :limit
            """;

    /** (b) 삭제됐는데 색인에 남아 있는 대상. */
    private static final String STALE_SQL = """
            SELECT td.tattoo_seq
              FROM tattoo_designs td
              JOIN tattoos t ON t.tattoo_seq = td.tattoo_seq
              JOIN images i ON i.image_seq = td.image_seq
             WHERE td.indexed = TRUE
               AND (td.is_deleted OR t.is_deleted OR i.is_deleted)
             ORDER BY td.tattoo_seq
             LIMIT :limit
            """;

    // 색인 반영 여부는 시스템 기록이라 mod_dttm 은 건드리지 않는다.
    private static final String MARK_INDEXED_SQL =
            "UPDATE tattoo_designs SET indexed = TRUE WHERE tattoo_seq = ?";
    private static final String MARK_UNINDEXED_SQL =
            "UPDATE tattoo_designs SET indexed = FALSE WHERE tattoo_seq = ?";

    private final CoverupProperties properties;
    private final CoverupEngineClient engineClient;
    private final MediaService mediaService;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final JdbcTemplate jdbcTemplate;

    @Scheduled(cron = "${app.coverup.index-sync-cron:0 */10 * * * *}", zone = "UTC")
    public void synchronize() {
        if (!properties.enabled()) {
            return;
        }
        try {
            int indexed = indexMissing();
            int removed = removeStale();
            if (indexed > 0 || removed > 0) {
                log.info("Coverup index synchronized: indexed={} removed={}", indexed, removed);
            }
        } catch (RuntimeException exception) {
            log.warn("Coverup index synchronization skipped: {}", exception.getMessage());
        }
    }

    /** (a) indexed = false 인 도안을 엔진에 올린다. */
    int indexMissing() {
        List<Candidate> candidates = namedParameterJdbcTemplate.query(
                MISSING_SQL,
                new MapSqlParameterSource("limit", properties.indexSyncBatchSize()),
                (rs, rowNum) -> new Candidate(
                        rs.getLong("tattoo_seq"),
                        rs.getString("object_key")
                )
        );
        List<Object[]> done = new ArrayList<>();
        for (Candidate candidate : candidates) {
            if (indexOne(candidate)) {
                done.add(new Object[]{candidate.tattooSeq()});
            }
        }
        if (!done.isEmpty()) {
            jdbcTemplate.batchUpdate(MARK_INDEXED_SQL, done);
        }
        return done.size();
    }

    /** (b) 삭제된 도안을 엔진 색인에서 뺀다. */
    int removeStale() {
        List<Long> keys = namedParameterJdbcTemplate.queryForList(
                STALE_SQL,
                new MapSqlParameterSource("limit", properties.indexSyncBatchSize()),
                Long.class
        );
        List<Object[]> done = new ArrayList<>();
        for (Long key : keys) {
            if (engineClient.remove(key)) {
                done.add(new Object[]{key});
            }
        }
        if (!done.isEmpty()) {
            jdbcTemplate.batchUpdate(MARK_UNINDEXED_SQL, done);
        }
        return done.size();
    }

    private boolean indexOne(Candidate candidate) {
        byte[] bytes;
        try {
            bytes = mediaService.objectBytes(candidate.objectKey());
        } catch (RuntimeException exception) {
            log.warn(
                    "Coverup indexing skipped; object unreadable: tattooSeq={} objectKey={}",
                    candidate.tattooSeq(),
                    candidate.objectKey()
            );
            return false;
        }
        String encoded = Base64.getEncoder().encodeToString(bytes);
        if (encoded.length() > MAX_IMAGE_BASE64_BYTES) {
            log.warn(
                    "Coverup indexing skipped; image too large: tattooSeq={} base64Bytes={}",
                    candidate.tattooSeq(),
                    encoded.length()
            );
            return false;
        }
        return engineClient.index(candidate.tattooSeq(), encoded);
    }

    private record Candidate(Long tattooSeq, String objectKey) {
    }
}
