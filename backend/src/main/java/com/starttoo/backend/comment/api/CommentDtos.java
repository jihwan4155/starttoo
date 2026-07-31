package com.starttoo.backend.comment.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class CommentDtos {

    private CommentDtos() {
    }

    public record CreateCommentRequest(
            @Schema(description = "답글 대상 댓글 seq. 최상위 댓글이면 null", example = "501")
            Long parentCommentSeq,
            @Schema(description = "댓글 내용", example = "색감이 정말 좋네요.")
            @NotBlank @Size(max = 1000) String content
    ) {
    }

    public record CommentResponse(
            Long commentSeq,
            Long postSeq,
            CommentAuthor author,
            Long parentCommentSeq,
            String content,
            int likeCount,
            int replyCount,
            boolean likedByMe,
            boolean deleted,
            OffsetDateTime regDttm,
            OffsetDateTime modDttm
    ) {
    }

    public record CommentAuthor(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            String profileImageUrl
    ) {
    }

    public record LikeStateRequest(
            @Schema(description = "최종 좋아요 상태", example = "true")
            @NotNull Boolean enabled
    ) {
    }

    public record LikeState(boolean enabled) {
    }
}
