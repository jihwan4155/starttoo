package com.starttoo.backend.artist.api;

import com.starttoo.backend.artist.domain.VerificationStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class ArtistDtos {

    private ArtistDtos() {
    }

    public record ArtistProfile(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            String profileImageUrl,
            String shopName,
            String shopCity,
            String shopAddress,
            String shopPhone,
            String shopDetails,
            VerificationStatus verificationStatus,
            long followerCount,
            OffsetDateTime regDttm
    ) {
    }

    public record UpdateArtistRequest(
            @Schema(description = "독립 엔티티가 아닌 프로필 표시용 숍 이름", example = "스타투 스튜디오")
            @Size(max = 100) String shopName,
            @Schema(description = "자유 도시명", example = "서울")
            @Size(max = 100) String shopCity,
            @Schema(description = "숍 주소", example = "서울특별시 강남구 테헤란로 1")
            @Size(max = 255) String shopAddress,
            @Schema(description = "숍 문의 전화번호", example = "02-1234-5678")
            @Size(max = 30) String shopPhone,
            @Schema(description = "영업시간·휴무일·예약 방식 자유 안내",
                    example = "평일 12:00~21:00, 예약제")
            @Size(max = 1000) String shopDetails
    ) {
    }

    public record VerificationRequest(
            @Schema(description = "심사 요청 확인값. true만 허용", example = "true")
            @NotNull @AssertTrue Boolean confirm
    ) {
    }

    public record VerificationDecision(
            @Schema(description = "관리자 심사 결과", example = "VERIFIED",
                    allowableValues = {"VERIFIED", "REJECTED"})
            @NotNull VerificationStatus status,
            @Schema(description = "REJECTED일 때 필수인 거절 사유",
                    example = "인증 자료를 확인할 수 없습니다.")
            @Size(max = 2000) String rejectionReason
    ) {
        @AssertTrue(message = "REJECTED 상태에는 rejectionReason이 필요합니다.")
        public boolean isValidReason() {
            return status == VerificationStatus.REJECTED
                    ? rejectionReason != null && !rejectionReason.isBlank()
                    : rejectionReason == null || rejectionReason.isBlank();
        }
    }
}
