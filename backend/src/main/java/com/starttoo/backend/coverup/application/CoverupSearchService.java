package com.starttoo.backend.coverup.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.coverup.api.CoverupDtos;
import com.starttoo.backend.coverup.application.CoverupEngineClient.EngineMode;
import com.starttoo.backend.coverup.application.CoverupEngineClient.Hit;
import com.starttoo.backend.coverup.config.CoverupProperties;
import com.starttoo.backend.media.application.MediaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 마스크 검색 요청 한 건을 처리한다.
 *
 * <p>엔진 호출 → DB 메타 조회 1회 → 엔진 순위로 재정렬 → Presigned URL 발급 순서다.
 * DB 는 메타 조회 한 번만 쓴다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CoverupSearchService {

    private static final String PUBLIC_MODE_COVERUP = "coverup";
    private static final String PUBLIC_MODE_SHAPE = "shape";

    /**
     * is_deleted 는 tattoos·tattoo_designs·images 세 곳에 있다. 하나라도 빠뜨리면
     * 삭제된 도안이 계속 검색에 노출된다.
     *
     * <p>정렬을 걸지 않는 것은 의도다. IN 조회 순서는 검색 점수와 무관하므로
     * 정렬은 엔진이 준 순위로 자바에서 한다.
     */
    private static final String META_SQL = """
            SELECT t.tattoo_seq,
                   i.object_key,
                   ps.style_code,
                   ps.style_name
              FROM tattoos t
              JOIN tattoo_designs td ON td.tattoo_seq = t.tattoo_seq
              JOIN images i ON i.image_seq = td.image_seq
              LEFT JOIN primary_styles ps ON ps.primary_style_seq = t.primary_style_seq
             WHERE t.tattoo_seq IN (:keys)
               AND t.is_deleted = FALSE
               AND td.is_deleted = FALSE
               AND i.is_deleted = FALSE
            """;

    private final CoverupEngineClient engineClient;
    private final CoverupProperties properties;
    private final MediaService mediaService;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public CoverupDtos.SearchResponse search(CoverupDtos.SearchRequest request) {
        String mask = stripDataUrlPrefix(request.maskPngB64());
        validateMaskSize(mask);
        EngineMode engineMode = engineMode(request.mode());

        List<Hit> hits = engineClient.search(mask, engineMode).results();
        if (hits.isEmpty()) {
            return new CoverupDtos.SearchResponse(request.mode(), 0, List.of());
        }

        Map<Long, Double> scores = new HashMap<>();
        Map<Long, Integer> rank = new HashMap<>();
        for (int index = 0; index < hits.size(); index++) {
            Hit hit = hits.get(index);
            // 엔진이 같은 key 를 두 번 주더라도 앞선 순위만 남긴다.
            rank.putIfAbsent(hit.key(), index);
            scores.putIfAbsent(hit.key(), hit.score());
        }

        List<DesignMeta> rows = namedParameterJdbcTemplate.query(
                META_SQL,
                new MapSqlParameterSource("keys", rank.keySet()),
                (rs, rowNum) -> new DesignMeta(
                        rs.getLong("tattoo_seq"),
                        rs.getString("object_key"),
                        rs.getString("style_code"),
                        rs.getString("style_name")
                )
        );
        if (rows.size() < hits.size()) {
            log.info(
                    "Coverup search dropped {} deleted or missing designs of {}",
                    hits.size() - rows.size(),
                    hits.size()
            );
        }

        List<CoverupDtos.DesignResult> results = rows.stream()
                .sorted((left, right) -> Integer.compare(
                        rank.get(left.tattooSeq()),
                        rank.get(right.tattooSeq())
                ))
                .limit(properties.resultSize())
                .map(row -> new CoverupDtos.DesignResult(
                        row.tattooSeq(),
                        mediaService.presignedDownload(
                                row.objectKey(),
                                properties.presignExpiry()
                        ).url(),
                        roundScore(scores.get(row.tattooSeq())),
                        row.styleCode(),
                        row.styleName()
                ))
                .toList();
        return new CoverupDtos.SearchResponse(request.mode(), results.size(), results);
    }

    /** 엔진과 같은 기준으로 재려면 {@code data:} 접두어를 뗀 뒤에 길이를 봐야 한다. */
    private String stripDataUrlPrefix(String value) {
        int separator = value.lastIndexOf(',');
        return separator < 0 ? value.trim() : value.substring(separator + 1).trim();
    }

    private void validateMaskSize(String mask) {
        if (mask.isEmpty()) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        if (mask.length() > properties.maxMaskBase64Bytes()) {
            throw BusinessException.of(ErrorCode.MASK_TOO_LARGE);
        }
    }

    private EngineMode engineMode(String mode) {
        return switch (mode.toLowerCase(Locale.ROOT)) {
            case PUBLIC_MODE_COVERUP -> EngineMode.GATE;
            case PUBLIC_MODE_SHAPE -> EngineMode.LINE;
            default -> throw new BusinessException(
                    ErrorCode.INVALID_REQUEST,
                    "mode 는 coverup 또는 shape 여야 합니다."
            );
        };
    }

    private double roundScore(double score) {
        return BigDecimal.valueOf(score)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private record DesignMeta(
            Long tattooSeq,
            String objectKey,
            String styleCode,
            String styleName
    ) {
    }
}
