package com.starttoo.backend.tattoo.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.tattoo.api.TattooDtos;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class TattooService {

    private final TattooRepository tattooRepository;
    private final ImageRepository imageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final SearchIndexEventPublisher searchIndexEventPublisher;

    @Transactional
    public Tattoo process(Integer userSeq, Long imageSeq, TattooSourceType sourceType) {
        tattooRepository.findByImageSeqAndDeletedFalse(imageSeq).ifPresent(existing -> {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        });
        Image image = imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .filter(value -> value.getRegUsrSeq().equals(userSeq))
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));

        /*
         * TODO(model-integration)
         * 모델 서버 계약이 확정되면 아래 흐름을 복구한다.
         * 1) image의 MinIO 단기 다운로드 URL 발급
         * 2) 타투 여부 판별이 true인 경우에만 분석 모델 호출
         * 3) 분석 결과 코드와 subject를 검증한 뒤 저장
         *
         * TattooModelClient.Analysis analysis =
         *         modelClient.analyze(mediaService.downloadUrl(image));
         */
        TattooModelClient.Analysis analysis = temporaryAnalysis();

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
        List<TattooDtos.SubjectResponse> subjects = jdbcTemplate.query("""
                SELECT s.subject_seq, s.subject_name
                  FROM tattoo_subjects ts
                  JOIN subjects s ON s.subject_seq = ts.subject_seq
                 WHERE ts.tattoo_seq = ?
                 ORDER BY s.subject_seq
                """, (rs, rowNum) -> new TattooDtos.SubjectResponse(
                rs.getInt("subject_seq"),
                rs.getString("subject_name")
        ), tattooSeq);
        return new TattooDtos.TattooResponse(
                tattoo.getTattooSeq(),
                tattoo.getRegistrantSeq(),
                tattoo.getImageSeq(),
                tattoo.getSourceType(),
                tattoo.getPrimaryStyleSeq(),
                compact(tattoo.getSecondaryStyle1Seq(), tattoo.getSecondaryStyle2Seq()),
                compact(tattoo.getRenderingStyle1Seq(), tattoo.getRenderingStyle2Seq()),
                tattoo.getColorSeq(),
                subjects,
                tattoo.isUsedForTraining(),
                tattoo.getTrainedDttm(),
                tattoo.getRegDttm()
        );
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

    private TattooModelClient.Analysis temporaryAnalysis() {
        // API·트랜잭션 검증용 고정값이다. 운영 분석 결과로 사용하면 안 된다.
        return new TattooModelClient.Analysis(
                "OTHER",
                List.of(),
                List.of("LINE"),
                "BLACK",
                List.of("타투")
        );
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

    private List<Integer> compact(Integer first, Integer second) {
        List<Integer> result = new ArrayList<>();
        if (first != null) {
            result.add(first);
        }
        if (second != null) {
            result.add(second);
        }
        return Collections.unmodifiableList(result);
    }
}
