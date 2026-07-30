package com.starttoo.backend.collection.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class CollectionDtos {

    private CollectionDtos() {
    }

    public record CreateCollectionRequest(
            @Schema(description = "컬렉션에 등록할 본인 소유 이미지 seq", example = "201")
            @NotNull Long imageSeq,
            @Schema(description = "표준 신체 뷰", example = "front")
            @NotBlank @Size(max = 10) String bodyView,
            @Schema(description = "신체 뷰 너비 기준 정규화 X 좌표", example = "0.42")
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double positionX,
            @Schema(description = "신체 뷰 높이 기준 정규화 Y 좌표", example = "0.35")
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double positionY,
            @Schema(description = "기준 크기 대비 배율", example = "0.8")
            @NotNull @DecimalMin(value = "0.0", inclusive = false) Double scaleRatio,
            @Schema(description = "시계 방향 회전 각도", example = "-15")
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double rotationDegree,
            @Schema(description = "좌우 뒤집기 여부", example = "false")
            @NotNull Boolean flipped
    ) {
    }

    public record UpdatePlacementRequest(
            @Schema(description = "표준 신체 뷰", example = "front")
            @NotBlank @Size(max = 10) String bodyView,
            @Schema(description = "0~1 정규화 X 좌표", example = "0.42")
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double positionX,
            @Schema(description = "0~1 정규화 Y 좌표", example = "0.35")
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double positionY,
            @Schema(description = "0보다 큰 배율", example = "0.8")
            @NotNull @DecimalMin(value = "0.0", inclusive = false) Double scaleRatio,
            @Schema(description = "-180~180도 회전", example = "-15")
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double rotationDegree,
            @Schema(description = "좌우 뒤집기 여부", example = "false")
            @NotNull Boolean flipped
    ) {
    }

    public record CollectionResponse(
            Long collectionSeq,
            Long tattooSeq,
            Long imageSeq,
            String bodyView,
            double positionX,
            double positionY,
            double scaleRatio,
            double rotationDegree,
            boolean flipped,
            OffsetDateTime regDttm,
            OffsetDateTime modDttm
    ) {
    }
}
