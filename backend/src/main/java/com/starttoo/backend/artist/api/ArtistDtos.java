package com.starttoo.backend.artist.api;

import com.starttoo.backend.artist.domain.VerificationStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

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

    public record ArtistListItem(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            @Schema(description = "프로필 이미지의 단기 Presigned GET URL")
            String profileImageUrl,
            String shopName,
            String shopCity,
            String shopAddress,
            String shopPhone,
            String shopDetails,
            VerificationStatus verificationStatus,
            long followerCount,
            @Schema(description = "최신 공개 게시물. 최대 6개")
            List<ArtistPostSummary> posts,
            OffsetDateTime regDttm
    ) {
    }

    public record ArtistPostSummary(
            @Schema(description = "게시물 식별자", example = "2001")
            Long postSeq,
            @Schema(description = "첫 번째 게시물 이미지의 단기 Presigned GET URL")
            String imageUrl,
            @Schema(description = "게시물 좋아요 수", example = "12")
            int likeCount
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

}
