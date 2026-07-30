package com.starttoo.backend.user.api;

import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class UserDtos {

    private UserDtos() {
    }

    public record PublicProfile(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            UserRole role,
            long followerCount,
            long followingCount,
            boolean followedByMe
    ) {
    }

    public record MyProfile(
            Integer userSeq,
            String nickname,
            String phoneNumber,
            OffsetDateTime phoneVerifiedDttm,
            Long profileImageSeq,
            LocalDate birthDate,
            String gender,
            UserRole role,
            AccountStatus accountStatus,
            List<String> recentSearchTerms,
            OffsetDateTime regDttm
    ) {
    }

    public record UpdateProfileRequest(
            @Schema(description = "2~20자 대소문자 구분 닉네임", example = "BlackRose1")
            @NotBlank
            @Pattern(regexp = "^[가-힣A-Za-z0-9]{2,20}$") String nickname,
            @Schema(description = "본인이 업로드한 프로필 이미지 seq", example = "101")
            Long profileImageSeq,
            @Schema(description = "선택 생년월일", example = "1998-05-21")
            LocalDate birthDate,
            @Schema(description = "선택 성별 코드", example = "F",
                    allowableValues = {"M", "F"})
            @Pattern(regexp = "M|F") String gender
    ) {
    }

    public record RelationState(boolean enabled) {
    }

    public record RecentSearchRequest(
            @Schema(description = "최근 검색 목록에 올릴 원문. 앞뒤 공백은 제거", example = "검은 장미")
            @NotBlank
            @Size(max = 100)
            @Pattern(regexp = "^[^\\p{Cc}]+$")
            String term
    ) {
    }
}
