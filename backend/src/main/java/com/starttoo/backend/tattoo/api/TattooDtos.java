package com.starttoo.backend.tattoo.api;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

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

    public record GenerateTattooRequest(
            @Size(max = 500) String prompt,
            @Size(max = 2) List<String> style,
            @Positive Long referenceImageSeq,
            @PositiveOrZero @Max(4_294_967_295L) Long seed,
            @Min(1) @Max(100) Integer steps,
            @DecimalMin("0.0") @DecimalMax("30.0") Double guidance,
            Integer size
    ) {
        private static final Set<String> SUPPORTED_STYLES = Set.of(
                "realism",
                "minimal",
                "geometric_ornamental",
                "lettering",
                "graphic_illustrative",
                "new_school",
                "tribal_indigenous",
                "western_traditional",
                "japanese",
                "abstract_experimental"
        );

        public GenerateTattooRequest {
            prompt = prompt == null ? "" : prompt.trim();
            style = style == null ? List.of() : List.copyOf(style);
            steps = steps == null ? 30 : steps;
            guidance = guidance == null ? 7.5 : guidance;
            size = size == null ? 1024 : size;
        }

        @AssertTrue(message = "지원하지 않는 타투 스타일입니다.")
        @JsonIgnore
        public boolean isSupportedStyle() {
            return style.stream().allMatch(SUPPORTED_STYLES::contains);
        }

        @AssertTrue(message = "prompt 또는 referenceImageSeq 중 하나는 필요합니다.")
        @JsonIgnore
        public boolean hasPromptOrReference() {
            if (style.contains("lettering")) {
                return !prompt.isBlank();
            }
            return !prompt.isBlank() || referenceImageSeq != null;
        }

        @AssertTrue(message = "size는 512, 768, 1024 중 하나여야 합니다.")
        @JsonIgnore
        public boolean isSupportedSize() {
            return size == 512 || size == 768 || size == 1024;
        }
    }

    public enum TattooImageVariant {
        ORIGINAL,
        DESIGN
    }

    public record ClassificationItem(Integer seq, String code, String name) {
    }
}
