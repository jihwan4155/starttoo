package com.starttoo.domain.artist.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class ArtistDtos {
    private ArtistDtos() {}

    public record Shop(
            String shopName, String shopCity, String shopAddress, String shopPhone, String businessHours
    ) {}

    public record FeedPreview(Long postId, String imageUrl, long likeCount) {}

    public record ArtistItem(
            Long userId, String nickname, String profileImageUrl, Shop shop,
            String approvalStatus, BigDecimal popularity, long followerCount,
            boolean isFollowing, boolean isMe, List<FeedPreview> feedPreviews
    ) {}

    public record UpdateArtistRequest(
            @Size(max=100) @Schema(description = "숍 이름", example = "Moon Needle") String shopName,
            @Size(max=30) @Schema(description = "'시'를 제외한 도시명", example = "서울") String shopCity,
            @Size(max=500) @Schema(description = "숍 상세 주소", example = "서울특별시 마포구") String shopAddress,
            @Size(max=30) @Schema(description = "숍 전화번호", example = "02-1234-5678") String shopPhone,
            @Size(max=500) @Schema(description = "영업시간과 휴무·예약 등 특이사항", example = "화~일 12:00~20:00, 예약제") String businessHours
    ) {}

    public record ArtistProfileResponse(
            Long userId, String shopName, String shopCity, String shopAddress, String shopPhone,
            String businessHours, BigDecimal popularity, String approvalStatus,
            String rejectionReason, Instant approvedAt, Instant updatedAt
    ) {}
}
