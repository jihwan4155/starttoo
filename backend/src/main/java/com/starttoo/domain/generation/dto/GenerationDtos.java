package com.starttoo.domain.generation.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class GenerationDtos {
    private GenerationDtos() {}
    public record AiGenerationRequest(
            @NotBlank @Size(max=100) @Schema(description = "주 스타일", example = "BLACKWORK") String primaryStyle,
            @Size(max=100) @Schema(description = "선택적인 보조 스타일", example = "LINEWORK") String secondaryStyle,
            @NotBlank @Size(max=2000) @Schema(description = "생성할 도안 설명", example = "팔뚝에 어울리는 미니멀한 달과 별, 얇은 선") String promptText,
            @Schema(description = "선택적인 참고 이미지 objectKey", example = "generation/101/reference.webp") String referenceImageObjectKey
    ) {}
    public record AiGenerationResponse(
            String imageUrl, String primaryStyle, String secondaryStyle, Instant createdAt
    ) {}
    public record CoverupRequest(
            @NotBlank @Schema(description = "커버업 대상 타투 이미지 objectKey", example = "coverups/101/source.webp") String imageObjectKey
    ) {}
    public record CoverupResponse(String imageUrl, Instant createdAt) {}
}
