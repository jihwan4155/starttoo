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
            ClassificationValue primaryStyle,
            List<ClassificationValue> secondaryStyles,
            List<ClassificationValue> renderingStyles,
            ClassificationValue color,
            List<String> subjects,
            boolean usedForTraining,
            OffsetDateTime trainedDttm,
            OffsetDateTime regDttm
    ) {
    }

    public record ClassificationValue(
            @Schema(description = "프론트 로직에서 사용할 안정적인 분류 코드", example = "BLACKWORK")
            String code,
            @Schema(description = "화면 표시용 분류명", example = "블랙워크")
            String name
    ) {
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
            @Schema(description = "주 스타일 기준정보")
            ClassificationValue primaryStyle,
            @Schema(description = "색상 기준정보. 분류되지 않았으면 null")
            ClassificationValue color,
            @Schema(description = "Subject 이름 목록. 없으면 빈 배열")
            List<String> subjects,
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
