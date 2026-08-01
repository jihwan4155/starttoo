package com.starttoo.backend.comment.api;

import com.starttoo.backend.comment.application.CommentService;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/v1")
@RequiredArgsConstructor
@Tag(name = "Comments", description = "게시물 댓글과 댓글 좋아요")
public class CommentController {

    private final CommentService commentService;

    @PostMapping("/posts/{postSeq}/comments")
    @Operation(
            summary = "댓글 또는 답글 작성",
            description = """
                    대상 게시물이 PUBLISHED인지 확인한다. parentCommentSeq가 있으면 같은 게시물의
                    PUBLISHED 최상위 댓글인지 검증한 뒤 답글로 저장한다. 답글에 다시 답글을
                    연결하는 2단계 초과 계층은 허용하지 않는다. 댓글 생성과 게시물 commentCount의
                    원자적 증가를 하나의 트랜잭션으로 처리하며 댓글 서비스 알림은 생성하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CommentDtos.CommentResponse> create(
            @PathVariable Long postSeq,
            @Valid @RequestBody CommentDtos.CreateCommentRequest request
    ) {
        return ApiResponse.of(commentService.create(
                SecurityUtils.currentUserSeq(),
                postSeq,
                request
        ));
    }

    @GetMapping("/posts/{postSeq}/comments")
    @OptionalAuth
    @Operation(
            summary = "최상위 댓글 목록",
            description = """
                    commentSeq 오름차순 커서를 사용하여 활성 최상위 댓글만 반환한다. 각 항목에는
                    활성 답글 수 replyCount를 포함하며 로그인 조회자는 likedByMe를 계산한다.
                    """
    )
    public ApiResponse<CursorPageResponse<CommentDtos.CommentResponse>> list(
            @PathVariable Long postSeq,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size,
            Authentication authentication
    ) {
        Integer viewer = authentication instanceof JwtAuthenticationToken jwt
                ? Integer.valueOf(jwt.getToken().getSubject())
                : null;
        return ApiResponse.of(commentService.list(postSeq, cursor, size, viewer));
    }

    @GetMapping("/comments/{commentSeq}/replies")
    @OptionalAuth
    @Operation(
            summary = "댓글 답글 목록",
            description = """
                    지정한 활성 최상위 댓글을 부모로 갖는 활성 1단계 답글만 commentSeq 오름차순
                    커서로 반환한다. 답글의 replyCount는 항상 0이며 로그인 조회자는 likedByMe를
                    계산한다. 삭제된 최상위 댓글은 조회할 수 없다.
                    """
    )
    public ApiResponse<CursorPageResponse<CommentDtos.CommentResponse>> replies(
            @PathVariable Long commentSeq,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size,
            Authentication authentication
    ) {
        Integer viewer = authentication instanceof JwtAuthenticationToken jwt
                ? Integer.valueOf(jwt.getToken().getSubject())
                : null;
        return ApiResponse.of(commentService.replies(commentSeq, cursor, size, viewer));
    }

    @DeleteMapping("/comments/{commentSeq}")
    @Operation(
            summary = "댓글 작성자 삭제",
            description = """
                    작성자만 삭제할 수 있다. 답글이면 해당 답글만, 최상위 댓글이면 현재 활성
                    답글까지 한 번에 소프트 삭제한다. posts.commentCount는 실제 삭제된 행 수만큼
                    원자적으로 감소하며 생성·삭제 경쟁은 최상위 댓글 행 잠금으로 직렬화한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<Boolean> delete(@PathVariable Long commentSeq) {
        commentService.delete(SecurityUtils.currentUserSeq(), commentSeq);
        return ApiResponse.of(true);
    }

    @PutMapping("/comments/{commentSeq}/like")
    @Operation(
            summary = "댓글 좋아요",
            description = """
                    좋아요 관계를 멱등하게 생성하고 실제 신규 생성일 때만 comment.likeCount를
                    원자적으로 +1 한다. 관계와 카운트는 같은 트랜잭션이며 알림은 생성하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CommentDtos.LikeState> like(@PathVariable Long commentSeq) {
        return ApiResponse.of(new CommentDtos.LikeState(
                commentService.setLike(
                        SecurityUtils.currentUserSeq(),
                        commentSeq,
                        true
                )
        ));
    }

    @DeleteMapping("/comments/{commentSeq}/like")
    @Operation(
            summary = "댓글 좋아요 해제",
            description = """
                    좋아요 관계를 멱등하게 삭제하고 실제 삭제된 경우에만 comment.likeCount를
                    원자적으로 -1 한다. 관계와 카운트 변경은 같은 트랜잭션으로 묶이며 반복 요청은
                    카운트를 중복 변경하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CommentDtos.LikeState> unlike(@PathVariable Long commentSeq) {
        return ApiResponse.of(new CommentDtos.LikeState(
                commentService.setLike(
                        SecurityUtils.currentUserSeq(),
                        commentSeq,
                        false
                )
        ));
    }
}
