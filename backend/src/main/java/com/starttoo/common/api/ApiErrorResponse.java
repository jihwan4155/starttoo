package com.starttoo.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ApiErrorResponse(
        @Schema(description = "HTTP 상태코드", example = "409") int status,
        @Schema(description = "클라이언트 분기용 에러 코드", example = "NICKNAME_DUPLICATED") String code,
        @Schema(description = "오류 설명", example = "이미 사용 중인 닉네임입니다.") String message,
        @Schema(description = "필드 단위 검증 오류. 해당하지 않으면 생략") List<FieldErrorDetail> errors
) {
    public static ApiErrorResponse of(int status, String code, String message) {
        return new ApiErrorResponse(status, code, message, null);
    }
}
