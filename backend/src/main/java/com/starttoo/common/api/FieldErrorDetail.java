package com.starttoo.common.api;

import io.swagger.v3.oas.annotations.media.Schema;

public record FieldErrorDetail(
        @Schema(description = "검증에 실패한 요청 필드", example = "nickname") String field,
        @Schema(description = "필드 검증 실패 사유", example = "이미 사용 중인 닉네임입니다.") String reason
) {
}
