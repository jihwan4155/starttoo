package com.starttoo.backend.comment.api;

import com.starttoo.backend.comment.domain.CommentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
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

    public record UpdateCommentRequest(
            @Schema(description = "수정할 댓글 내용", example = "수정한 댓글입니다.")
            @NotBlank @Size(max = 1000) String content
    ) {
    }

    public record CommentResponse(
            Long commentSeq,
            Long postSeq,
            Integer authorSeq,
            String authorNickname,
            Long parentCommentSeq,
            String content,
            int likeCount,
            CommentStatus commentStatus,
            boolean likedByMe,
            OffsetDateTime regDttm,
            OffsetDateTime modDttm
    ) {
    }

    public record LikeState(boolean enabled) {
    }
}
