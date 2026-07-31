package com.starttoo.backend.tattoo.api;

import com.starttoo.backend.tattoo.domain.TattooSourceType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;

public final class TattooDtos {

    private TattooDtos() {
    }

    public record TattooResponse(
            Long tattooSeq,
            Integer registrantSeq,
            Long imageSeq,
            TattooSourceType sourceType,
            Integer primaryStyleSeq,
            List<Integer> secondaryStyleSeqs,
            List<Integer> renderingStyleSeqs,
            Integer colorSeq,
            List<SubjectResponse> subjects,
            boolean usedForTraining,
            OffsetDateTime trainedDttm,
            OffsetDateTime regDttm
    ) {
    }

    public record SubjectResponse(Integer subjectSeq, String subjectName) {
    }

    public record TattooDesignResponse(
            @Schema(description = "도안 타투 식별자", example = "501")
            Long tattooSeq,
            @Schema(description = "가공된 도안 이미지 식별자", example = "301")
            Long designImageSeq,
            @Schema(
                    description = "가공된 도안 이미지의 단기 Presigned GET URL",
                    example = "https://minio.example.com/starttoo/design.png?X-Amz-Algorithm=AWS4-HMAC-SHA256"
            )
            String designImageUrl,
            @Schema(description = "주 스타일 식별자", example = "1")
            Integer primaryStyleSeq,
            @Schema(description = "색상 식별자. 분류되지 않았으면 null", example = "2")
            Integer colorSeq,
            @Schema(description = "Subject 목록. 없으면 빈 배열")
            List<SubjectResponse> subjects,
            @Schema(description = "현재 로그인 회원의 보관 여부", example = "false")
            boolean archivedByMe,
            @Schema(description = "도안 등록 시각")
            OffsetDateTime regDttm
    ) {
    }

    public record TattooImageResponse(
            @Schema(description = "선택한 variant의 이미지 식별자", example = "301")
            Long imageSeq,
            @Schema(
                    description = "이미지 단기 Presigned GET URL",
                    example = "https://minio.example.com/starttoo/design.png?X-Amz-Algorithm=AWS4-HMAC-SHA256"
            )
            String downloadUrl,
            @Schema(description = "다운로드 URL 만료 시각")
            OffsetDateTime expiresAt
    ) {
    }

    public enum TattooImageVariant {
        ORIGINAL,
        DESIGN
    }

    public record ClassificationItem(Integer seq, String code, String name) {
    }
}
