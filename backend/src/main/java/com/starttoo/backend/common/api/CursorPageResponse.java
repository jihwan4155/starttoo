package com.starttoo.backend.common.api;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "커서 기반 목록 응답")
public record CursorPageResponse<T>(
        @Schema(description = "현재 페이지 데이터")
        List<T> items,
        @Schema(description = "다음 페이지 요청에 그대로 전달할 불투명 커서. 다음 페이지가 없으면 null")
        String nextCursor,
        @Schema(description = "다음 페이지 존재 여부")
        boolean hasNext,
        @Schema(description = "이번 응답에 포함된 실제 항목 수")
        int size
) {
    public static <T> CursorPageResponse<T> of(List<T> fetched, int requestedSize, String nextCursor) {
        boolean hasNext = fetched.size() > requestedSize;
        List<T> items = hasNext ? fetched.subList(0, requestedSize) : fetched;
        return new CursorPageResponse<>(items, hasNext ? nextCursor : null, hasNext, items.size());
    }

    public static <T> CursorPageResponse<T> of(List<T> items, String nextCursor, boolean hasNext) {
        return new CursorPageResponse<>(
                items,
                hasNext ? nextCursor : null,
                hasNext,
                items.size()
        );
    }
}
