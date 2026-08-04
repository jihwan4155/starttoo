package com.starttoo.backend.tattoo.application;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.tattoo.api.TattooDtos;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooDesign;
import com.starttoo.backend.tattoo.domain.TattooDesignRepository;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class TattooService {

    private final TattooRepository tattooRepository;
    private final TattooDesignRepository tattooDesignRepository;
    private final ImageRepository imageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final MediaService mediaService;
    private final TattooModelClient tattooModelClient;
    private final SearchIndexEventPublisher searchIndexEventPublisher;

    public PreparedTattoo prepare(Integer userSeq, Long imageSeq) {
        Image image = imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .filter(value -> value.getRegUsrSeq().equals(userSeq))
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        mediaService.verifyStoredObject(image.getObjectKey());
        String imageUrl = mediaService.downloadUrl(image.getObjectKey());
        TattooModelClient.Analysis analysis = tattooModelClient.analyzeIfTattoo(imageUrl)
                .orElseThrow(() -> BusinessException.of(ErrorCode.NOT_TATTOO_IMAGE));
        return new PreparedTattoo(image.getImageSeq(), image.getObjectKey(), analysis);
    }

    public PreparedPostImage preparePostImage(Integer userSeq, Long imageSeq) {
        Image image = imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .filter(value -> value.getRegUsrSeq().equals(userSeq))
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        mediaService.verifyStoredObject(image.getObjectKey());
        return new PreparedPostImage(image.getImageSeq(), image.getObjectKey());
    }

    /**
     * 게시물 이미지 한 장의 분석 결과를 저장한다. 재시도로 다시 들어올 수 있으므로
     * 이미 tattoos 행이 있으면 조용히 넘어간다(멱등).
     *
     * <p>호출자는 이미지 한 장씩 호출해야 한다. 여러 장을 한 트랜잭션으로 묶으면
     * 한 장의 실패가 이미 성공한 다른 장까지 롤백시킨다.
     */
    @Transactional
    public void persistPostImageAnalysis(
            Integer userSeq,
            PreparedPostImage image,
            TattooModelClient.Analysis analysis
    ) {
        if (tattooRepository.findByImageSeqAndDeletedFalse(image.imageSeq()).isPresent()) {
            return;
        }
        persistPrepared(
                userSeq,
                new PreparedTattoo(image.imageSeq(), image.objectKey(), analysis),
                TattooSourceType.USER_POST
        );
    }

    @Transactional
    public Tattoo persistPrepared(
            Integer userSeq,
            PreparedTattoo prepared,
            TattooSourceType sourceType
    ) {
        Long imageSeq = prepared.imageSeq();
        tattooRepository.findByImageSeqAndDeletedFalse(imageSeq).ifPresent(existing -> {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        });
        imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .filter(value -> value.getRegUsrSeq().equals(userSeq))
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        TattooModelClient.Analysis analysis = prepared.analysis();

        Integer primary = classificationSeq(
                "primary_styles", "primary_style_seq", "style_code", analysis.primaryStyleCode(), true
        );
        List<Integer> secondary = classificationSeqs(
                "secondary_styles", "secondary_style_seq", analysis.secondaryStyleCodes()
        );
        List<Integer> rendering = classificationSeqs(
                "rendering_styles", "rendering_style_seq", analysis.renderingStyleCodes()
        );
        Integer color = classificationSeq(
                "colors", "color_seq", "color_code", analysis.colorCode(), false
        );
        OffsetDateTime now = OffsetDateTime.now();
        Tattoo tattoo = tattooRepository.save(Tattoo.builder()
                .registrantSeq(userSeq)
                .imageSeq(imageSeq)
                .sourceType(sourceType)
                .primaryStyleSeq(primary)
                .secondaryStyle1Seq(valueAt(secondary, 0))
                .secondaryStyle2Seq(valueAt(secondary, 1))
                .renderingStyle1Seq(valueAt(rendering, 0))
                .renderingStyle2Seq(valueAt(rendering, 1))
                .colorSeq(color)
                .usedForTraining(false)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build());

        if (analysis.subjects() != null) {
            new LinkedHashSet<>(analysis.subjects()).stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .limit(20)
                    .forEach(subject -> linkSubject(tattoo.getTattooSeq(), subject));
        }
        return tattoo;
    }

    @Transactional(readOnly = true)
    public TattooDtos.TattooResponse get(Long tattooSeq) {
        Tattoo tattoo = tattooRepository.findByTattooSeqAndDeletedFalse(tattooSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        List<String> subjects = jdbcTemplate.queryForList("""
                SELECT s.subject_name
                  FROM tattoo_subjects ts
                  JOIN subjects s ON s.subject_seq = ts.subject_seq
                 WHERE ts.tattoo_seq = ?
                 ORDER BY s.subject_seq
                """, String.class, tattooSeq);
        TattooLabels labels = labels(tattooSeq);
        return new TattooDtos.TattooResponse(
                tattoo.getTattooSeq(),
                tattoo.getRegistrantSeq(),
                tattoo.getImageSeq(),
                tattoo.getSourceType(),
                labels.primary(),
                compact(labels.secondary1(), labels.secondary2()),
                compact(labels.rendering1(), labels.rendering2()),
                labels.color(),
                subjects,
                tattoo.isUsedForTraining(),
                tattoo.getTrainedDttm(),
                tattoo.getRegDttm()
        );
    }

    public record PreparedTattoo(
            Long imageSeq,
            String objectKey,
            TattooModelClient.Analysis analysis
    ) {
    }

    /**
     * 게시물 저장 시점에 확보하는 정보. 분석 결과는 게시 응답 이후 비동기로 채우므로
     * 여기에 담지 않는다.
     */
    public record PreparedPostImage(
            Long imageSeq,
            String objectKey
    ) {
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<TattooDtos.TattooDesignResponse> designs(
            Integer userSeq,
            String cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        DesignCursor decoded = decodeDesignCursor(cursor);
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("userSeq", userSeq, Types.INTEGER)
                .addValue(
                        "cursorDttm",
                        decoded == null ? null : decoded.regDttm(),
                        Types.TIMESTAMP_WITH_TIMEZONE
                )
                .addValue(
                        "cursorTattooSeq",
                        decoded == null ? null : decoded.tattooSeq(),
                        Types.BIGINT
                )
                .addValue("limit", safeSize + 1, Types.INTEGER);
        List<DesignRow> rows = namedParameterJdbcTemplate.query("""
                SELECT td.tattoo_seq,
                       td.image_seq AS design_image_seq,
                       image.object_key AS design_object_key,
                       primary_style.style_code AS primary_style_code,
                       primary_style.style_name AS primary_style_name,
                       color.color_code,
                       color.color_name,
                       td.reg_dttm,
                       CASE
                           WHEN :userSeq IS NULL THEN FALSE
                           ELSE EXISTS(
                               SELECT 1
                                 FROM user_archive archive
                                WHERE archive.user_seq = :userSeq
                                  AND archive.tattoo_seq = td.tattoo_seq
                           )
                       END AS archived_by_me
                  FROM tattoo_designs td
                  JOIN tattoos tattoo
                    ON tattoo.tattoo_seq = td.tattoo_seq
                   AND tattoo.is_deleted = FALSE
                  JOIN images image
                    ON image.image_seq = td.image_seq
                   AND image.is_deleted = FALSE
                  JOIN primary_styles primary_style
                    ON primary_style.primary_style_seq = tattoo.primary_style_seq
                  LEFT JOIN colors color
                    ON color.color_seq = tattoo.color_seq
                 WHERE td.is_deleted = FALSE
                   AND (
                       CAST(:cursorDttm AS timestamptz) IS NULL
                       OR td.reg_dttm < :cursorDttm
                       OR (
                           td.reg_dttm = :cursorDttm
                           AND td.tattoo_seq < :cursorTattooSeq
                       )
                   )
                 ORDER BY td.reg_dttm DESC, td.tattoo_seq DESC
                 LIMIT :limit
                """, parameters, (rs, rowNum) -> new DesignRow(
                rs.getLong("tattoo_seq"),
                rs.getLong("design_image_seq"),
                rs.getString("design_object_key"),
                new TattooDtos.ClassificationValue(
                        rs.getString("primary_style_code"),
                        rs.getString("primary_style_name")
                ),
                rs.getString("color_code") == null ? null
                        : new TattooDtos.ClassificationValue(
                        rs.getString("color_code"),
                        rs.getString("color_name")
                ),
                rs.getBoolean("archived_by_me"),
                rs.getObject("reg_dttm", OffsetDateTime.class)
        ));
        boolean hasNext = rows.size() > safeSize;
        List<DesignRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        Map<Long, List<String>> subjects =
                subjectsByTattoo(page.stream().map(DesignRow::tattooSeq).toList());
        List<TattooDtos.TattooDesignResponse> items = page.stream()
                .map(row -> new TattooDtos.TattooDesignResponse(
                        row.tattooSeq(),
                        row.designImageSeq(),
                        mediaService.downloadUrl(row.designObjectKey()),
                        row.primaryStyle(),
                        row.color(),
                        subjects.getOrDefault(row.tattooSeq(), List.of()),
                        row.archivedByMe(),
                        row.regDttm()
                ))
                .toList();
        String nextCursor = hasNext ? encodeDesignCursor(page.get(page.size() - 1)) : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    @Transactional(readOnly = true)
    public TattooDtos.TattooImageResponse image(
            Long tattooSeq,
            TattooDtos.TattooImageVariant variant
    ) {
        Tattoo tattoo = tattooRepository.findByTattooSeqAndDeletedFalse(tattooSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        Long imageSeq = switch (variant) {
            case ORIGINAL -> tattoo.getImageSeq();
            case DESIGN -> tattooDesignRepository.findByTattooSeqAndDeletedFalse(tattooSeq)
                    .map(TattooDesign::getImageSeq)
                    .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        };
        Image image = imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        MediaService.PresignedDownload download =
                mediaService.presignedDownload(image.getObjectKey());
        return new TattooDtos.TattooImageResponse(
                image.getImageSeq(),
                download.url(),
                download.expiresAt()
        );
    }

    private Map<Long, List<String>> subjectsByTattoo(
            List<Long> tattooSeqs
    ) {
        if (tattooSeqs.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<String>> result = new HashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT ts.tattoo_seq, subject.subject_seq, subject.subject_name
                  FROM tattoo_subjects ts
                  JOIN subjects subject ON subject.subject_seq = ts.subject_seq
                 WHERE ts.tattoo_seq IN (:tattooSeqs)
                 ORDER BY ts.tattoo_seq, subject.subject_seq
                """, new MapSqlParameterSource("tattooSeqs", tattooSeqs), rs -> {
            result.computeIfAbsent(rs.getLong("tattoo_seq"), ignored -> new ArrayList<>())
                    .add(rs.getString("subject_name"));
        });
        return result;
    }

    private DesignCursor decodeDesignCursor(String cursor) {
        if (cursor == null) {
            return null;
        }
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(cursor),
                    StandardCharsets.UTF_8
            );
            String[] values = decoded.split("\\|", -1);
            if (values.length != 2) {
                throw new IllegalArgumentException("invalid cursor");
            }
            return new DesignCursor(OffsetDateTime.parse(values[0]), Long.parseLong(values[1]));
        } catch (RuntimeException exception) {
            throw BusinessException.of(ErrorCode.INVALID_CURSOR);
        }
    }

    private String encodeDesignCursor(DesignRow row) {
        String value = row.regDttm() + "|" + row.tattooSeq();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private void linkSubject(Long tattooSeq, String subject) {
        if (subject.length() > 50) {
            subject = subject.substring(0, 50);
        }
        int inserted = jdbcTemplate.update(
                "INSERT INTO subjects (subject_name) VALUES (?) ON CONFLICT (subject_name) DO NOTHING",
                subject
        );
        Integer subjectSeq = jdbcTemplate.queryForObject(
                "SELECT subject_seq FROM subjects WHERE subject_name = ?",
                Integer.class,
                subject
        );
        jdbcTemplate.update("""
                INSERT INTO tattoo_subjects (tattoo_seq, subject_seq)
                VALUES (?, ?)
                ON CONFLICT DO NOTHING
                """, tattooSeq, subjectSeq);
        if (inserted > 0) {
            searchIndexEventPublisher.subjectChanged(subjectSeq);
        }
    }

    private List<Integer> classificationSeqs(String table, String seqColumn, List<String> codes) {
        if (codes == null) {
            return List.of();
        }
        return codes.stream()
                .limit(2)
                .map(code -> classificationSeq(table, seqColumn, "style_code", code, true))
                .distinct()
                .toList();
    }

    private Integer classificationSeq(
            String table,
            String seqColumn,
            String codeColumn,
            String code,
            boolean required
    ) {
        if (code == null || code.isBlank()) {
            if (required) {
                throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
            }
            return null;
        }
        List<Integer> values = jdbcTemplate.queryForList(
                "SELECT " + seqColumn + " FROM " + table
                        + " WHERE " + codeColumn + " = ? AND is_active = TRUE",
                Integer.class,
                code
        );
        if (values.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.STATE_CONFLICT,
                    "모델 결과 코드가 활성 기준정보에 없습니다: " + code
            );
        }
        return values.get(0);
    }

    private Integer valueAt(List<Integer> values, int index) {
        return values.size() > index ? values.get(index) : null;
    }

    private List<TattooDtos.ClassificationValue> compact(
            TattooDtos.ClassificationValue first,
            TattooDtos.ClassificationValue second
    ) {
        List<TattooDtos.ClassificationValue> result = new ArrayList<>();
        if (first != null) {
            result.add(first);
        }
        if (second != null) {
            result.add(second);
        }
        return List.copyOf(result);
    }

    private TattooLabels labels(Long tattooSeq) {
        return jdbcTemplate.queryForObject("""
                SELECT primary_style.style_code AS primary_code,
                       primary_style.style_name AS primary_name,
                       secondary1.style_code AS secondary1_code,
                       secondary1.style_name AS secondary1_name,
                       secondary2.style_code AS secondary2_code,
                       secondary2.style_name AS secondary2_name,
                       rendering1.style_code AS rendering1_code,
                       rendering1.style_name AS rendering1_name,
                       rendering2.style_code AS rendering2_code,
                       rendering2.style_name AS rendering2_name,
                       color.color_code,
                       color.color_name
                  FROM tattoos tattoo
                  JOIN primary_styles primary_style
                    ON primary_style.primary_style_seq = tattoo.primary_style_seq
                  LEFT JOIN secondary_styles secondary1
                    ON secondary1.secondary_style_seq = tattoo.secondary_style1_seq
                  LEFT JOIN secondary_styles secondary2
                    ON secondary2.secondary_style_seq = tattoo.secondary_style2_seq
                  LEFT JOIN rendering_styles rendering1
                    ON rendering1.rendering_style_seq = tattoo.rendering_style1_seq
                  LEFT JOIN rendering_styles rendering2
                    ON rendering2.rendering_style_seq = tattoo.rendering_style2_seq
                  LEFT JOIN colors color
                    ON color.color_seq = tattoo.color_seq
                 WHERE tattoo.tattoo_seq = ?
                """, (rs, rowNum) -> new TattooLabels(
                value(rs.getString("primary_code"), rs.getString("primary_name")),
                value(rs.getString("secondary1_code"), rs.getString("secondary1_name")),
                value(rs.getString("secondary2_code"), rs.getString("secondary2_name")),
                value(rs.getString("rendering1_code"), rs.getString("rendering1_name")),
                value(rs.getString("rendering2_code"), rs.getString("rendering2_name")),
                value(rs.getString("color_code"), rs.getString("color_name"))
        ), tattooSeq);
    }

    private TattooDtos.ClassificationValue value(String code, String name) {
        return code == null ? null : new TattooDtos.ClassificationValue(code, name);
    }

    private record DesignCursor(OffsetDateTime regDttm, Long tattooSeq) {
    }

    private record DesignRow(
            Long tattooSeq,
            Long designImageSeq,
            String designObjectKey,
            TattooDtos.ClassificationValue primaryStyle,
            TattooDtos.ClassificationValue color,
            boolean archivedByMe,
            OffsetDateTime regDttm
    ) {
    }

    private record TattooLabels(
            TattooDtos.ClassificationValue primary,
            TattooDtos.ClassificationValue secondary1,
            TattooDtos.ClassificationValue secondary2,
            TattooDtos.ClassificationValue rendering1,
            TattooDtos.ClassificationValue rendering2,
            TattooDtos.ClassificationValue color
    ) {
    }
}
