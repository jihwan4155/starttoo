package com.starttoo.backend.coverup.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

public final class CoverupDtos {

    private CoverupDtos() {
    }

    public record SearchRequest(
            @Schema(
                    description = "검은 배경 + 흰 획 PNG의 base64. data: 접두어를 붙여도 된다.",
                    example = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"
            )
            @NotBlank
            String maskPngB64,
            @Schema(
                    description = "coverup(그린 영역 안쪽까지 덮는 도안) 또는 shape(선 형태가 닮은 도안)",
                    example = "coverup",
                    allowableValues = {"coverup", "shape"}
            )
            @NotBlank
            String mode
    ) {
    }

    public record SearchResponse(
            @Schema(description = "요청한 검색 모드", example = "coverup")
            String mode,
            @Schema(description = "results 길이. 삭제된 도안이 빠지면 요청 개수보다 적을 수 있다.", example = "16")
            int count,
            @Schema(description = "검색 점수 내림차순 도안 목록")
            List<DesignResult> results
    ) {
    }

    public record DesignResult(
            @Schema(description = "도안 타투 식별자", example = "183920")
            Long tattooSeq,
            @Schema(
                    description = "도안 이미지의 Presigned GET URL",
                    example = "https://minio.example.com/starttoo/design.png?X-Amz-Algorithm=AWS4-HMAC-SHA256"
            )
            String imageUrl,
            @Schema(description = "검색 점수. 소수 2자리", example = "0.86")
            double score,
            @Schema(description = "주 스타일 코드. 미분류면 생략", example = "geometric_ornamental")
            String styleCode,
            @Schema(description = "주 스타일 이름. 미분류면 생략", example = "기하·장식")
            String styleName
    ) {
    }
}
