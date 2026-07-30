package com.starttoo.backend.ai.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class AiDtos {

    private AiDtos() {
    }

    public record GenerationRequest(
            @Schema(description = "생성할 타투 도안 설명",
                    example = "검은 장미와 나비를 조합한 라인워크 타투")
            @NotBlank @Size(max = 1000) String prompt
    ) {
    }

    public record CoverupRequest(
            @Schema(description = "본인이 업로드한 기존 타투 이미지 seq", example = "401")
            @NotNull Long imageSeq,
            @Schema(description = "원하는 커버업 방향", example = "어두운 만다라 형태로 덮어줘")
            @NotBlank @Size(max = 1000) String prompt
    ) {
    }

    public record SimulationRequest(
            @Schema(description = "본인이 업로드한 신체 이미지 seq", example = "501")
            @NotNull Long bodyImageSeq,
            @Schema(description = "본인이 업로드한 타투 도안 이미지 seq", example = "502")
            @NotNull Long tattooImageSeq,
            @Schema(description = "표준 신체 뷰", example = "front")
            @NotBlank @Size(max = 10) String bodyView,
            @Schema(description = "0~1 정규화 X 좌표", example = "0.42")
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double positionX,
            @Schema(description = "0~1 정규화 Y 좌표", example = "0.35")
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double positionY,
            @Schema(description = "배율", example = "0.8")
            @NotNull @DecimalMin(value = "0.0", inclusive = false) Double scaleRatio,
            @Schema(description = "회전 각도", example = "-15")
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double rotationDegree,
            @Schema(description = "좌우 뒤집기", example = "false")
            @NotNull Boolean flipped
    ) {
    }
}
