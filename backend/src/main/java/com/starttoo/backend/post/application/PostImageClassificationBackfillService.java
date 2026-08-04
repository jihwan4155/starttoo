package com.starttoo.backend.post.application;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.tattoo.application.TattooService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 분류가 밀린 게시물 이미지를 주기적으로 다시 처리한다.
 *
 * <p>비동기 워커는 최선 노력일 뿐이다. 서버가 재시작되거나 AI 서버가 죽어 있으면 그 작업은
 * 사라지는데, post_images.classification_status 가 DB 에 남아 있으므로 이 잡이 주워서
 * 최종적으로 처리한다. 즉 정확성은 워커가 아니라 이 스케줄러가 보장한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PostImageClassificationBackfillService {

    private final AiProperties properties;
    private final PostTattooClassificationService classificationService;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Scheduled(cron = "${app.ai.classification-backfill-cron:0 */5 * * * *}", zone = "UTC")
    public void backfill() {
        if (!properties.enabled()) {
            return;
        }
        List<PendingImage> claimed = claim();
        if (claimed.isEmpty()) {
            return;
        }
        // 같은 게시물의 이미지는 한 번의 배치 호출로 묶는다. AI 서버가 배열을 받아
        // 순차 처리하므로 게시물 단위로 보내는 편이 왕복과 추론 슬롯 점유를 줄인다.
        Map<PostAuthor, List<PendingImage>> byPost = claimed.stream()
                .collect(Collectors.groupingBy(
                        image -> new PostAuthor(image.postSeq(), image.authorSeq()),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        log.info("Post tattoo classification backfill started: images={}, posts={}",
                claimed.size(), byPost.size());
        // 스케줄러 스레드에서 직접 추론하지 않는다. 스케줄러 풀은 기본 1개라 여기서 수 분을
        // 잡으면 다른 @Scheduled 잡까지 밀린다. 게시 직후 경로와 같은 큐에 넘겨 직렬화한다.
        byPost.forEach((post, images) -> classificationService.classifyAsync(
                post.authorSeq(),
                images.stream()
                        .map(image -> new TattooService.PreparedPostImage(
                                image.imageSeq(),
                                image.objectKey()
                        ))
                        .toList()
        ));
    }

    /**
     * 처리할 행을 선점한다. 한 문장이므로 원자적이고, 추론에 수 분이 걸리는 동안 DB 트랜잭션을
     * 붙잡지 않는다. {@code FOR UPDATE ... SKIP LOCKED} 는 여러 인스턴스가 동시에 선점을
     * 시도할 때 같은 행을 중복으로 집지 않게 한다.
     *
     * <p>선점 즉시 FAILED 로 표시하고 시도 횟수를 올린다. 처리 도중 프로세스가 죽어도 행이
     * 영구히 진행 중 상태로 남지 않고 재시도 간격 후 다시 대상이 되며, 상한에 도달하면
     * 더 이상 집히지 않아 장애 이미지가 AI 서버를 계속 점유하지 못한다. 성공하면
     * {@link PostImageClassificationWriter} 가 DONE 또는 NOT_TATTOO 로 덮어쓴다.
     *
     * <p>PENDING 은 재시도 간격만큼의 유예를 두고 집는다. 그래야 게시 직후 비동기 워커가
     * 처리하고 있는 이미지를 곧바로 중복 처리하지 않는다.
     */
    private List<PendingImage> claim() {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("maxAttempts", properties.classificationMaxAttempts())
                .addValue("retryDelaySeconds", properties.classificationRetryDelay().toSeconds())
                .addValue("limit", properties.classificationBackfillBatchSize());
        return namedParameterJdbcTemplate.query("""
                WITH candidate AS (
                    SELECT pi.post_image_seq
                      FROM post_images pi
                      JOIN images image
                        ON image.image_seq = pi.image_seq
                       AND image.is_deleted = FALSE
                      JOIN posts post
                        ON post.post_seq = pi.post_seq
                       AND post.is_deleted = FALSE
                     WHERE (
                             pi.classification_status = 'PENDING'
                             AND pi.reg_dttm
                                 < CURRENT_TIMESTAMP
                                   - MAKE_INTERVAL(secs => :retryDelaySeconds)
                           )
                        OR (
                             pi.classification_status = 'FAILED'
                             AND pi.classification_attempt_count < :maxAttempts
                             AND (
                                 pi.classification_mod_dttm IS NULL
                              OR pi.classification_mod_dttm
                                 < CURRENT_TIMESTAMP
                                   - MAKE_INTERVAL(secs => :retryDelaySeconds)
                             )
                           )
                     ORDER BY pi.post_seq, pi.display_order
                     LIMIT :limit
                     FOR UPDATE OF pi SKIP LOCKED
                )
                UPDATE post_images target
                   SET classification_status = 'FAILED',
                       classification_attempt_count = target.classification_attempt_count + 1,
                       classification_mod_dttm = CURRENT_TIMESTAMP,
                       mod_dttm = CURRENT_TIMESTAMP
                  FROM candidate,
                       images image,
                       posts post
                 WHERE target.post_image_seq = candidate.post_image_seq
                   AND image.image_seq = target.image_seq
                   AND post.post_seq = target.post_seq
                RETURNING target.post_seq,
                          target.image_seq,
                          target.display_order,
                          image.object_key,
                          post.author_seq
                """, parameters, (rs, rowNum) -> new PendingImage(
                rs.getLong("post_seq"),
                rs.getLong("image_seq"),
                rs.getShort("display_order"),
                rs.getString("object_key"),
                rs.getInt("author_seq")
        )).stream()
                // UPDATE ... RETURNING 은 행 순서를 보장하지 않는다. 게시물별로 묶어
                // 표시 순서대로 보내려면 여기서 정렬해야 한다.
                .sorted(Comparator
                        .comparing(PendingImage::postSeq)
                        .thenComparing(PendingImage::displayOrder))
                .toList();
    }

    private record PendingImage(
            Long postSeq,
            Long imageSeq,
            short displayOrder,
            String objectKey,
            Integer authorSeq
    ) {
    }

    private record PostAuthor(Long postSeq, Integer authorSeq) {
    }
}
