package com.starttoo.domain.post.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class PostDtos {
    private PostDtos() {}

    public record Author(Long userId, String nickname, String profileImageUrl, String role) {}
    public record PostImage(Long postImageId, Long imageId, String imageUrl, int displayOrder) {}
    public record PostResponse(
            Long postId, String postType, String content, String postStatus, Author author,
            List<PostImage> images, long likeCount, long commentCount,
            boolean liked, boolean bookmarked, boolean hidden,
            Instant bookmarkedAt, Instant createdAt, Instant updatedAt
    ) {}

    public record ImageObject(
            @NotBlank @Schema(description = "Presigned PUT 업로드가 완료된 이미지 objectKey", example = "posts/101/uuid.webp") String objectKey
    ) {}

    public record CreatePostRequest(
            @NotBlank @Schema(description = "게시글 유형", example = "GENERAL") String postType,
            @Size(max=10000) @Schema(description = "선택적인 게시글 본문. 이미지만으로 작성 가능", example = "새 타투 작업입니다.") String content,
            @NotEmpty @Size(max=10) @Schema(description = "표시 순서대로 전달하는 이미지 1~10개") List<@Valid ImageObject> images
    ) {}

    public record UpdatePostRequest(
            @Schema(description = "변경할 게시글 유형. 생략하면 유지") String postType,
            @Size(max=10000) @Schema(description = "새 본문. null 또는 생략 시 본문 제거") String content,
            @Schema(description = "유지할 기존 postImageId를 최종 표시 순서대로 전달. 생략하면 기존 이미지 전부 유지", example = "[11, 13]") List<Long> retainedPostImageIds,
            @Size(max=10) @Schema(description = "기존 유지 이미지 뒤에 추가할 새 이미지") List<@Valid ImageObject> newImages
    ) {}

    public record LikeResponse(Long postId, boolean liked, long likeCount) {}
    public record BookmarkResponse(Long postId, boolean bookmarked) {}
    public record HiddenResponse(Long postId, boolean hidden) {}

    public record ReportRequest(
            @NotBlank @Schema(description = "신고 사유", allowableValues = {"SPAM", "INAPPROPRIATE", "HARASSMENT", "COPYRIGHT", "OTHER"}, example = "SPAM") String reasonCode,
            @Size(max=1000) @Schema(description = "상세 신고 사유. reasonCode가 OTHER이면 필수") String reasonDetail
    ) {}
    public record ReportResponse(
            Long reportId, Long postId, String reasonCode, String reasonDetail,
            String reportStatus, Instant createdAt
    ) {}

    public record SearchRequest(
            @Size(max=1000) @Schema(description = "텍스트 검색어. 이미지와 함께 또는 단독 사용", example = "미니멀한 달과 별") String textQuery,
            @Schema(description = "검색 기준으로 사용할 업로드 완료 이미지 objectKey", example = "search/101/uuid.webp") String imageObjectKey
    ) {}
    public record SearchItem(
            Long postImageId, Long postId, String imageUrl, Long authorId, double similarityScore
    ) {}
}
