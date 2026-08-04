package com.starttoo.backend.post;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.post.application.PostImageClassificationBackfillService;
import com.starttoo.backend.post.application.PostTattooClassificationService;
import com.starttoo.backend.tattoo.application.TattooService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 선점 SQL 과 V11 마이그레이션은 PostgreSQL 전용 문법(데이터 변경 CTE, FOR UPDATE SKIP LOCKED,
 * MAKE_INTERVAL, 부분 인덱스)을 쓰므로 실제 PostgreSQL 에 대고 확인한다.
 */
@Testcontainers(disabledWithoutDocker = true)
class PostImageClassificationClaimTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:17-alpine");

    private static JdbcTemplate jdbcTemplate;
    private static NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    private PostTattooClassificationService classificationService;
    private PostImageClassificationBackfillService backfillService;

    @BeforeAll
    static void migrate() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()
        );
        Flyway.configure()
                .dataSource(
                        POSTGRES.getJdbcUrl(),
                        POSTGRES.getUsername(),
                        POSTGRES.getPassword()
                )
                .locations("classpath:db/migration")
                .load()
                .migrate();
        jdbcTemplate = new JdbcTemplate(dataSource);
        namedParameterJdbcTemplate = new NamedParameterJdbcTemplate(dataSource);
    }

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM post_images");
        jdbcTemplate.update("DELETE FROM posts");
        jdbcTemplate.update("DELETE FROM images");
        jdbcTemplate.update("DELETE FROM users WHERE user_seq = 900");
        classificationService = mock(PostTattooClassificationService.class);
        backfillService = new PostImageClassificationBackfillService(
                properties(),
                classificationService,
                namedParameterJdbcTemplate
        );
        seedAuthorAndPost();
    }

    @Test
    void claimsPendingImagesOlderThanGracePeriod() {
        insertImage(601L, "object-601");
        insertPostImage(601L, (short) 1, "PENDING", 0, null, "45 minutes");

        backfillService.backfill();

        assertThat(claimedImageSeqs()).containsExactly(601L);
        // 선점 즉시 시도 횟수를 차감해, 처리 도중 프로세스가 죽어도 무한 재시도되지 않는다.
        assertThat(attemptCount(601L)).isEqualTo(1);
        assertThat(status(601L)).isEqualTo("FAILED");
    }

    @Test
    void leavesRecentPendingImagesToTheAsyncWorker() {
        insertImage(602L, "object-602");
        insertPostImage(602L, (short) 1, "PENDING", 0, null, "10 seconds");

        backfillService.backfill();

        verify(classificationService, never()).classifyAsync(any(), any());
        assertThat(status(602L)).isEqualTo("PENDING");
        assertThat(attemptCount(602L)).isZero();
    }

    @Test
    void skipsTerminalAndExhaustedRows() {
        insertImage(603L, "object-603");
        insertImage(604L, "object-604");
        insertImage(605L, "object-605");
        insertPostImage(603L, (short) 1, "DONE", 0, "45 minutes", "45 minutes");
        insertPostImage(604L, (short) 2, "NOT_TATTOO", 0, "45 minutes", "45 minutes");
        // 시도 상한(5)에 도달한 행은 더 이상 AI 서버를 점유하지 않는다.
        insertPostImage(605L, (short) 3, "FAILED", 5, "45 minutes", "45 minutes");

        backfillService.backfill();

        verify(classificationService, never()).classifyAsync(any(), any());
    }

    @Test
    void retriesFailedRowsOnlyAfterRetryDelay() {
        insertImage(606L, "object-606");
        insertImage(607L, "object-607");
        insertPostImage(606L, (short) 1, "FAILED", 1, "45 minutes", "45 minutes");
        insertPostImage(607L, (short) 2, "FAILED", 1, "10 seconds", "45 minutes");

        backfillService.backfill();

        assertThat(claimedImageSeqs()).containsExactly(606L);
        assertThat(attemptCount(606L)).isEqualTo(2);
        assertThat(attemptCount(607L)).isEqualTo(1);
    }

    @Test
    void groupsClaimedImagesOfTheSamePostIntoOneCall() {
        insertImage(608L, "object-608");
        insertImage(609L, "object-609");
        insertPostImage(608L, (short) 1, "PENDING", 0, null, "45 minutes");
        insertPostImage(609L, (short) 2, "PENDING", 0, null, "45 minutes");

        backfillService.backfill();

        ArgumentCaptor<List<TattooService.PreparedPostImage>> captor =
                ArgumentCaptor.forClass(List.class);
        verify(classificationService).classifyAsync(eq(900), captor.capture());
        assertThat(captor.getValue())
                .extracting(TattooService.PreparedPostImage::imageSeq)
                .containsExactly(608L, 609L);
        assertThat(captor.getValue())
                .extracting(TattooService.PreparedPostImage::objectKey)
                .containsExactly("object-608", "object-609");
    }

    /** 어떤 상태에서도 post_images 행은 사라지지 않는다. */
    @Test
    void neverDeletesPostImageRows() {
        insertImage(610L, "object-610");
        insertPostImage(610L, (short) 1, "PENDING", 0, null, "45 minutes");

        backfillService.backfill();
        backfillService.backfill();

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM post_images WHERE image_seq = 610",
                Integer.class
        )).isEqualTo(1);
    }

    @SuppressWarnings("unchecked")
    private List<Long> claimedImageSeqs() {
        ArgumentCaptor<List<TattooService.PreparedPostImage>> captor =
                ArgumentCaptor.forClass(List.class);
        verify(classificationService).classifyAsync(eq(900), captor.capture());
        return captor.getValue().stream()
                .map(TattooService.PreparedPostImage::imageSeq)
                .toList();
    }

    private String status(Long imageSeq) {
        return jdbcTemplate.queryForObject(
                "SELECT classification_status FROM post_images WHERE image_seq = ?",
                String.class,
                imageSeq
        );
    }

    private int attemptCount(Long imageSeq) {
        return jdbcTemplate.queryForObject(
                "SELECT classification_attempt_count FROM post_images WHERE image_seq = ?",
                Integer.class,
                imageSeq
        );
    }

    private void seedAuthorAndPost() {
        jdbcTemplate.update("""
                INSERT INTO users (user_seq, nickname, role, account_status, is_deleted,
                                   reg_usr_seq, mod_usr_seq)
                VALUES (900, 'backfill-author', 'USER', 'ACTIVE', FALSE, 900, 900)
                ON CONFLICT (user_seq) DO NOTHING
                """);
        jdbcTemplate.update("""
                INSERT INTO posts (post_seq, author_seq, content, post_status, like_count,
                                   comment_count, report_count, is_deleted, mod_usr_seq)
                VALUES (700, 900, 'content', 'PUBLISHED', 0, 0, 0, FALSE, 900)
                """);
    }

    private void insertImage(Long imageSeq, String objectKey) {
        jdbcTemplate.update("""
                INSERT INTO images (image_seq, object_key, is_deleted, reg_usr_seq, mod_usr_seq)
                VALUES (?, ?, FALSE, 900, 900)
                """, imageSeq, objectKey);
    }

    private void insertPostImage(
            Long imageSeq,
            short displayOrder,
            String status,
            int attemptCount,
            String classificationAgo,
            String regAgo
    ) {
        jdbcTemplate.update("""
                INSERT INTO post_images (post_seq, image_seq, display_order,
                                         classification_status,
                                         classification_attempt_count,
                                         classification_mod_dttm,
                                         reg_dttm, mod_dttm)
                VALUES (700, ?, ?, ?, ?,
                        CASE WHEN CAST(? AS TEXT) IS NULL THEN NULL
                             ELSE CURRENT_TIMESTAMP - CAST(? AS INTERVAL) END,
                        CURRENT_TIMESTAMP - CAST(? AS INTERVAL),
                        CURRENT_TIMESTAMP)
                """, imageSeq, displayOrder, status, attemptCount,
                classificationAgo, classificationAgo, regAgo);
    }

    private AiProperties properties() {
        return new AiProperties(
                true,
                "http://ai.test",
                "/v1/tattoos/detect",
                "/v1/tattoos/analyze",
                "/v1/tattoos/analyze-batch",
                "/v1/generations",
                "/v1/coverups",
                "/v1/simulations",
                Duration.ofSeconds(30),
                Duration.ofSeconds(10),
                "0 */5 * * * *",
                5,
                20,
                Duration.ofMinutes(5)
        );
    }
}
