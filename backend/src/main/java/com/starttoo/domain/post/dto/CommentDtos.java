package com.starttoo.domain.post.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class CommentDtos {
    private CommentDtos() {}
    public record CommentAuthor(Long userId, String nickname, String profileImageUrl) {}
    public record CommentResponse(
            Long commentId, Long postId, Long parentCommentId, String content, String commentStatus,
            CommentAuthor author, long likeCount, boolean liked, long replyCount,
            Instant createdAt, Instant updatedAt
    ) {}
    public record CreateCommentRequest(
            @NotBlank @Size(max=1000) @Schema(description = "댓글 또는 답글 내용", example = "멋진 작업이네요.") String content,
            @Schema(description = "답글 작성 시 최상위 부모 댓글 ID. 일반 댓글이면 생략", example = "501") Long parentCommentId
    ) {}
    public record CommentLikeResponse(Long commentId, boolean liked, long likeCount) {}
}
