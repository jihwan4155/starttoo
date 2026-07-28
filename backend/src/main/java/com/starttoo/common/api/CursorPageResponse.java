package com.starttoo.common.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record CursorPageResponse<T>(
        @Schema(description = "현재 페이지의 리소스 목록") List<T> items,
        @Schema(description = "다음 페이지 요청에 그대로 전달할 불투명 커서. 다음 페이지가 없으면 null",
                example = "eyJwb3N0SWQiOjEyM30=") String nextCursor,
        @Schema(description = "다음 페이지 존재 여부", example = "true") boolean hasNext
) {
    public CursorPageResponse {
        items = List.copyOf(items);
    }
}
