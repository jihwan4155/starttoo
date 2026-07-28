package com.starttoo.common.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record PageResponse<T>(
        @Schema(description = "현재 페이지의 리소스 목록") List<T> items,
        @Schema(description = "현재 페이지 번호. 1부터 시작", example = "3") int page,
        @Schema(description = "페이지당 요청 개수", example = "20") int size,
        @Schema(description = "전체 리소스 개수", example = "84") long totalElements,
        @Schema(description = "전체 페이지 수", example = "5") int totalPages,
        @Schema(description = "이전 페이지 존재 여부", example = "true") boolean hasPrevious,
        @Schema(description = "다음 페이지 존재 여부", example = "true") boolean hasNext
) {
    public PageResponse {
        items = List.copyOf(items);
    }
}
