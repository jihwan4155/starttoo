package com.starttoo.backend.post.api;

import com.starttoo.backend.user.domain.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

public final class PostDtos {

    private PostDtos() {
    }

    public record CreatePostRequest(
            @Schema(description = "게시물 본문", example = "새로운 장미 타투 작업입니다.")
            @Size(max = 3000) String content,
            @Schema(description = "표시 순서대로 정렬된 본인 소유 이미지 seq. 중복 불가",
                    example = "[101, 102]")
            @NotEmpty @Size(max = 10) List<@NotNull Long> imageSeqs
    ) {
    }

    public record UpdatePostRequest(
            @Schema(description = "수정할 게시물 본문", example = "작업 설명을 수정했습니다.")
            @Size(max = 3000) String content
    ) {
    }

    public record PostImageResponse(
            Long postImageSeq,
            Long imageSeq,
            String imageUrl,
            Long tattooSeq,
            short displayOrder
    ) {
    }

    public record UserSummary(
            Integer userSeq,
            String nickname,
            UserRole role,
            Long profileImageSeq,
            String profileImageUrl
    ) {
    }

    public record PostResponse(
            Long postSeq,
            UserSummary author,
            String content,
            int likeCount,
            int commentCount,
            List<PostImageResponse> images,
            boolean likedByMe,
            boolean bookmarkedByMe,
            OffsetDateTime regDttm,
            OffsetDateTime modDttm
    ) {
    }

    public record StateResponse(boolean enabled) {
    }

    public record DwellRequest(
            @Schema(description = "프론트엔드가 계산한 게시물 체류시간(초)", example = "18",
                    minimum = "0", maximum = "3600")
            @NotNull @Min(0) @Max(3600) Integer seconds
    ) {
    }

    public record ReportRequest(
            @Schema(description = "서비스에서 정의한 신고 사유 코드", example = "INAPPROPRIATE")
            @NotBlank @Size(max = 30) String reasonCode,
            @Schema(description = "선택 상세 신고 사유", example = "타인의 작업물을 무단 도용했습니다.")
            @Size(max = 1000) String reasonDetail
    ) {
    }

    public record ReportResponse(
            Long reportSeq,
            ReportStatus reportStatus
    ) {
    }

    public enum ReportStatus {
        PENDING,
        ACCEPTED,
        REJECTED
    }
}
