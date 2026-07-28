package com.starttoo.domain.post.controller;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.post.dto.CommentDtos.*;
import com.starttoo.domain.post.service.CommentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@Tag(name="Comments", description="댓글·한 단계 답글·좋아요")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
public class CommentController {
    private final CommentService commentService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary="댓글 목록", description="replyCount만 반환하며 previewReplies는 반환하지 않습니다.")
    @GetMapping("/posts/{postId}/comments")
    public CursorPageResponse<CommentResponse> roots(@PathVariable Long postId,
            @RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue="LATEST") String sort) {
        return commentService.roots(authenticationFacade.optionalUserId().orElse(null), postId, cursor, size, sort);
    }
    @Operation(summary="답글 목록")
    @GetMapping("/comments/{commentId}/replies")
    public CursorPageResponse<CommentResponse> replies(@PathVariable Long commentId,
            @RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        return commentService.replies(authenticationFacade.optionalUserId().orElse(null), commentId, cursor, size);
    }
    @Operation(summary="댓글·답글 작성", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(@PathVariable Long postId, @Valid @RequestBody CreateCommentRequest request) {
        return commentService.create(authenticationFacade.requireUserId(), postId, request);
    }
    @Operation(summary="댓글 삭제", security=@SecurityRequirement(name="bearerAuth"))
    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> delete(@PathVariable Long commentId) {
        commentService.delete(authenticationFacade.requireUserId(), commentId);
        return ResponseEntity.noContent().build();
    }
    @Operation(summary="댓글 좋아요", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/comments/{commentId}/like")
    public CommentLikeResponse like(@PathVariable Long commentId) { return commentService.like(authenticationFacade.requireUserId(), commentId, true); }
    @Operation(summary="댓글 좋아요 취소", security=@SecurityRequirement(name="bearerAuth"))
    @DeleteMapping("/comments/{commentId}/like")
    public CommentLikeResponse unlike(@PathVariable Long commentId) { return commentService.like(authenticationFacade.requireUserId(), commentId, false); }
}
