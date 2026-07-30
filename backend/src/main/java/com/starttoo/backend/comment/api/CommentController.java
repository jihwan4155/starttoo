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
import org.springframework.web.bind.annotation.PatchMapping;
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
                    연결하는 2단계 초과 계층은 허용하지 않는다. 댓글 생성, 게시물 commentCount의
                    원자적 증가, 게시물 작성자 또는 부모 댓글 작성자 알림 생성을 하나의
                    트랜잭션으로 처리한다.
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
                    commentSeq 오름차순 커서를 사용하여 최상위 댓글만 반환한다. 활성 답글이 있는
                    삭제 댓글은 author와 content를 숨긴 tombstone으로 유지하고 각 항목에는 활성
                    답글 수 replyCount를 포함한다. 로그인 조회자는 likedByMe를 계산한다.
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
                    지정한 최상위 댓글을 부모로 갖는 활성 1단계 답글만 commentSeq 오름차순
                    커서로 반환한다. 삭제된 최상위 tombstone의 답글도 조회할 수 있으며 답글의
                    replyCount는 항상 0이다. 로그인 조회자는 likedByMe를 계산한다.
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

    @PatchMapping("/comments/{commentSeq}")
    @Operation(
            summary = "댓글 내용 수정",
            description = """
                    작성자만 활성 댓글의 내용을 수정할 수 있다. 내용, modDttm, modUsrSeq가 같은
                    트랜잭션에서 갱신되며 부모 관계와 게시물 연결은 변경하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CommentDtos.CommentResponse> update(
            @PathVariable Long commentSeq,
            @Valid @RequestBody CommentDtos.UpdateCommentRequest request
    ) {
        return ApiResponse.of(commentService.update(
                SecurityUtils.currentUserSeq(),
                commentSeq,
                request
        ));
    }

    @DeleteMapping("/comments/{commentSeq}")
    @Operation(
            summary = "댓글 작성자 삭제",
            description = """
                    작성자만 삭제할 수 있다. 댓글 상태와 isDeleted를 변경하는 소프트 삭제이며,
                    posts.commentCount를 원자적으로 -1 한다. 두 변경은 같은 트랜잭션에 포함된다.
                    최상위 댓글의 답글은 삭제하지 않으며 반복 삭제는 성공한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<Boolean> delete(@PathVariable Long commentSeq) {
        commentService.delete(SecurityUtils.currentUserSeq(), commentSeq);
        return ApiResponse.of(true);
    }

    @PutMapping("/comments/{commentSeq}/like")
    @Operation(
            summary = "댓글 좋아요 상태 설정",
            description = """
                    enabled=true이면 좋아요 관계를 멱등하게 생성하고 실제 신규 생성일 때만
                    comment.likeCount를 원자적으로 +1 하며 작성자 알림을 저장한다.
                    enabled=false이면 관계 삭제와 count -1을 수행한다. 관계·카운트·알림은 같은
                    트랜잭션으로 묶이며 동일 상태 반복 요청은 카운트를 중복 변경하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CommentDtos.LikeState> like(
            @PathVariable Long commentSeq,
            @Valid @RequestBody CommentDtos.LikeStateRequest request
    ) {
        return ApiResponse.of(new CommentDtos.LikeState(
                commentService.setLike(
                        SecurityUtils.currentUserSeq(),
                        commentSeq,
                        request.enabled()
                )
        ));
    }
}
