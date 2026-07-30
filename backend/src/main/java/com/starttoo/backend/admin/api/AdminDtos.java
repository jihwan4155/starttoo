package com.starttoo.backend.admin.api;

import com.starttoo.backend.user.domain.AccountStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record AccountStatusRequest(
            @Schema(description = "변경할 계정 상태", example = "SUSPENDED")
            @NotNull AccountStatus status,
            @Schema(description = "관리자 처리 사유", example = "커뮤니티 운영정책 반복 위반")
            @Size(max = 1000) String reasonDetail,
            @Schema(description = "SUSPENDED 만료 시각. 다른 상태에서는 null",
                    example = "2026-08-05T12:00:00+09:00")
            OffsetDateTime expiredDttm
    ) {
        @AssertTrue(message = "SUSPENDED 상태에는 미래의 expiredDttm이 필요합니다.")
        public boolean validExpiry() {
            return status == AccountStatus.SUSPENDED
                    ? expiredDttm != null && expiredDttm.isAfter(OffsetDateTime.now())
                    : expiredDttm == null;
        }
    }

    public record AccountStatusResponse(
            Integer userSeq,
            AccountStatus accountStatus,
            OffsetDateTime statusChangedDttm
    ) {
    }

    public record ReportDecision(
            @Schema(description = "신고 처리 결과", example = "ACCEPTED")
            @NotNull ReportStatus status,
            @Schema(description = "관리자 처리 메모", example = "운영정책 위반 이미지 확인")
            @NotBlank @Size(max = 1000) String processingNote
    ) {
    }

    public enum ReportStatus {
        ACCEPTED,
        REJECTED
    }
}
