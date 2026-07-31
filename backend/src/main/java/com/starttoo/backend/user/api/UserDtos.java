package com.starttoo.backend.user.api;

import com.starttoo.backend.artist.domain.VerificationStatus;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public final class UserDtos {

    private UserDtos() {
    }

    public record PublicProfile(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            String profileImageUrl,
            UserRole role,
            long followerCount,
            long followingCount,
            boolean followedByMe,
            ArtistProfileSummary artistProfile
    ) {
    }

    public record MyProfile(
            Integer userSeq,
            String nickname,
            String phoneNumber,
            OffsetDateTime phoneVerifiedDttm,
            Long profileImageSeq,
            String profileImageUrl,
            LocalDate birthDate,
            String gender,
            UserRole role,
            AccountStatus accountStatus,
            ArtistProfileSummary artistProfile,
            OffsetDateTime regDttm
    ) {
    }

    public record UpdateProfileRequest(
            @Schema(description = "2~20자 대소문자 구분 닉네임", example = "BlackRose1")
            @NotBlank
            @Pattern(regexp = "^[가-힣A-Za-z0-9]{2,20}$") String nickname,
            @Schema(description = "선택 생년월일", example = "1998-05-21")
            LocalDate birthDate,
            @Schema(description = "선택 성별 코드", example = "F",
                    allowableValues = {"M", "F"})
            @Pattern(regexp = "M|F") String gender
    ) {
    }

    public record ProfileImageRequest(
            @Schema(description = "본인이 PROFILE 목적으로 업로드한 활성 이미지 seq", example = "302")
            @NotNull Long imageSeq
    ) {
    }

    public record RelationState(boolean enabled) {
    }

    public record RelationUser(
            Integer userSeq,
            String nickname,
            UserRole role,
            Long profileImageSeq,
            String profileImageUrl,
            boolean followedByMe
    ) {
    }

    public record ArtistProfileSummary(
            String shopName,
            VerificationStatus verificationStatus
    ) {
    }

    public record RecentSearchUpdateRequest(
            @Schema(description = "최근 검색어 변경 명령", example = "ADD",
                    allowableValues = {"ADD", "REMOVE"})
            @NotNull RecentSearchOperation operation,
            @Schema(description = "최근 검색어 원문", example = "검은 장미")
            @NotBlank
            @Size(max = 100)
            @Pattern(regexp = "^[^\\p{Cc}]+$")
            String term
    ) {
    }

    public enum RecentSearchOperation {
        ADD,
        REMOVE
    }
}
