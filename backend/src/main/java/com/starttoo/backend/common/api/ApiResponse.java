package com.starttoo.backend.common.api;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "성공 응답. 성공 시 code/message를 중복 제공하지 않고 data만 감싼다.")
public record ApiResponse<T>(
        @Schema(description = "응답 데이터")
        T data
) {
    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(data);
    }
}
