package com.starttoo.domain.user.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class UserDtos {

    private UserDtos() {
    }

    public record ArtistInfo(
            String shopName, String shopCity, String shopAddress, String shopPhone,
            String businessHours, BigDecimal popularity, String approvalStatus,
            String rejectionReason, Instant approvedAt
    ) {
    }

    public record MeResponse(
            Long userId, String email, String nickname, String profileImageUrl,
            LocalDate birthDate, String gender, String role, String accountStatus,
            long followerCount, long followingCount, ArtistInfo artist, Instant createdAt
    ) {
    }

    public record UpdateMeRequest(
            @Size(min = 2, max = 50) @Schema(description = "변경할 닉네임. 생략하면 유지", example = "newNickname") String nickname,
            @Schema(description = "변경할 생년월일. 생략하면 유지", example = "1998-04-12") LocalDate birthDate,
            @Schema(description = "true이면 기존 생년월일을 NULL로 변경", example = "false") Boolean removeBirthDate,
            @Pattern(regexp = "MALE|FEMALE|OTHER|UNSPECIFIED")
            @Schema(description = "변경할 성별", allowableValues = {"MALE", "FEMALE", "OTHER", "UNSPECIFIED"}, example = "UNSPECIFIED") String gender,
            @Schema(description = "true이면 기존 성별을 NULL로 변경", example = "false") Boolean removeGender
    ) {
    }

    public record UpdateMeResponse(
            Long userId, String nickname, LocalDate birthDate, String gender,
            String role, Instant updatedAt
    ) {
    }

    public record ProfileImageRequest(
            @NotBlank
            @Size(max = 1000)
            @Schema(example = "users/101/profile/550e8400-e29b-41d4-a716-446655440000.webp")
            String profileImageObjectKey
    ) {
    }

    public record ProfileImageResponse(
            String profileImageUrl,
            Instant updatedAt
    ) {
    }

    public record PublicProfileResponse(
            Long userId, String nickname, String profileImageUrl, String role,
            long followerCount, long followingCount, boolean isFollowing, boolean isMe,
            ArtistInfo artist
    ) {
    }

    public record FollowResponse(Long userId, boolean following, long followerCount) {
    }

    public record DeviceRequest(
            @NotBlank @Size(max = 512) @Schema(description = "FCM/APNs/Web Push 토큰", example = "push-token") String pushToken,
            @NotBlank @Schema(description = "기기 플랫폼", allowableValues = {"WEB", "ANDROID", "IOS"}, example = "ANDROID") String platform
    ) {
    }

    public record DeviceResponse(
            Long deviceId, String platform, boolean active, Instant lastUsedAt, Instant createdAt
    ) {
    }

    public record FollowUserItem(
            Long userId, String nickname, String profileImageUrl, String role,
            boolean isFollowing, Instant followedAt
    ) {
    }

    public record RecentSearchRequest(
            @NotBlank @Size(max = 100) @Schema(description = "trim 후 저장할 최근 검색어", example = "블랙워크") String keyword
    ) {
    }

    public record RecentSearchItem(Long recentSearchId, String keyword, Instant searchedAt) {
    }

    public record RecentSearchListResponse(List<RecentSearchItem> items) {
    }

    public record BlockedUserItem(
            Long userId, String nickname, String profileImageUrl, Instant blockedAt
    ) {
    }

    public record BlockResponse(Long userId, boolean blocked) {
    }

    public record TattooPreferenceRequest(
            @NotNull @Schema(description = "중복되지 않은 선호 타투 ID 배열", example = "[101, 205, 309]") List<@NotNull Long> tattooIds,
            @DecimalMin("0.0001") @DecimalMax("9999.9999")
            @Schema(description = "각 SURVEY 선호에 저장할 점수. 생략하면 1.0000", example = "1.0000") BigDecimal score
    ) {
    }

    public record TattooPreferenceResponse(
            String preferenceSource, List<Long> tattooIds, int count, Instant updatedAt
    ) {
    }

    public record CollectionRequest(
            @NotBlank @Size(max = 50) @Schema(description = "타투를 적용한 신체 부위", example = "팔뚝") String bodyPart,
            @NotBlank @Schema(description = "Presigned PUT 업로드가 완료된 이미지 objectKey", example = "collections/101/uuid.webp") String imageObjectKey
    ) {
    }

    public record UpdateCollectionRequest(
            @Size(max = 50) @Schema(description = "변경할 신체 부위. 생략하면 유지", example = "어깨") String bodyPart,
            @Schema(description = "교체할 업로드 완료 이미지 objectKey. 생략하면 유지", example = "collections/101/new-uuid.webp") String imageObjectKey
    ) {
    }

    public record CollectionItem(
            Long collectionId, Long userId, String bodyPart, Long imageId,
            String imageUrl, Instant createdAt, Instant updatedAt
    ) {
    }

    public record WithdrawalRequest(
            @Size(max = 255) @Schema(description = "선택적인 탈퇴 사유", example = "서비스를 더 이상 사용하지 않음") String reason
    ) {
    }
}
