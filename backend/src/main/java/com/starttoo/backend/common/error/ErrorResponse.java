package com.starttoo.backend.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Schema(description = "오류 응답")
public record ErrorResponse(
        @Schema(example = "2026-07-29T07:30:00Z")
        OffsetDateTime timestamp,
        @Schema(example = "400")
        int status,
        @Schema(example = "VALIDATION_ERROR")
        String code,
        @Schema(example = "입력값 검증에 실패했습니다.")
        String message,
        @Schema(description = "필드 검증 실패 상세. 일반 업무 오류에서는 생략")
        @JsonInclude(JsonInclude.Include.NON_EMPTY)
        List<FieldViolation> errors
) {
    public static ErrorResponse of(ErrorCode code, String message) {
        return new ErrorResponse(
                OffsetDateTime.now(ZoneOffset.UTC),
                code.getHttpStatus().value(),
                code.code(),
                message,
                List.of()
        );
    }

    public static ErrorResponse of(ErrorCode code, String message, List<FieldViolation> errors) {
        return new ErrorResponse(
                OffsetDateTime.now(ZoneOffset.UTC),
                code.getHttpStatus().value(),
                code.code(),
                message,
                errors
        );
    }

    @Schema(description = "요청 필드 한 건의 검증 실패")
    public record FieldViolation(
            @Schema(example = "nickname") String field,
            @Schema(example = "a!") Object rejectedValue,
            @Schema(example = "올바른 형식이어야 합니다.") String reason
    ) {
    }
}
