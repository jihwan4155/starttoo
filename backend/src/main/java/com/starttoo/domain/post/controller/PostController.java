package com.starttoo.domain.post.controller;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.common.exception.FeatureNotImplementedException;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.post.dto.PostDtos.*;
import com.starttoo.domain.post.service.PostService;
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
@Tag(name="Posts", description="커뮤니티 게시글·개인화 피드·검색")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
public class PostController {
    private final PostService postService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary="공개 전체 피드 목록", description="인증 및 개인화를 적용하지 않는 유일한 전체 게시글 목록입니다.")
    @GetMapping("/posts")
    public CursorPageResponse<PostResponse> feed(
            @RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue="LATEST") String sort,
            @RequestParam(required=false) String postType,
            @RequestParam(required=false) Long authorId) {
        return postService.publicFeed(cursor, size, sort, postType, authorId);
    }

    @Operation(summary="게시글 상세 조회", description="인증 선택")
    @GetMapping("/posts/{postId}")
    public PostResponse detail(@PathVariable Long postId) {
        return postService.detail(authenticationFacade.optionalUserId().orElse(null), postId);
    }

    @Operation(summary="게시글 작성", description="먼저 Presigned PUT으로 이미지를 올린 뒤 objectKey 배열을 전달합니다.", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse create(@Valid @RequestBody CreatePostRequest request) {
        return postService.create(authenticationFacade.requireUserId(), request);
    }

    @Operation(summary="게시글 수정", security=@SecurityRequirement(name="bearerAuth"))
    @PatchMapping("/posts/{postId}")
    public PostResponse update(@PathVariable Long postId, @Valid @RequestBody UpdatePostRequest request) {
        return postService.update(authenticationFacade.requireUserId(), postId, request);
    }

    @Operation(summary="게시글 삭제", security=@SecurityRequirement(name="bearerAuth"))
    @DeleteMapping("/posts/{postId}")
    public ResponseEntity<Void> delete(@PathVariable Long postId) {
        postService.delete(authenticationFacade.requireUserId(), postId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary="게시글 좋아요", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/posts/{postId}/like")
    public LikeResponse like(@PathVariable Long postId) { return postService.like(authenticationFacade.requireUserId(), postId, true); }
    @Operation(summary="게시글 좋아요 취소", security=@SecurityRequirement(name="bearerAuth"))
    @DeleteMapping("/posts/{postId}/like")
    public LikeResponse unlike(@PathVariable Long postId) { return postService.like(authenticationFacade.requireUserId(), postId, false); }

    @Operation(summary="게시글 북마크", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/posts/{postId}/bookmark")
    public BookmarkResponse bookmark(@PathVariable Long postId) { return postService.bookmark(authenticationFacade.requireUserId(), postId, true); }
    @Operation(summary="게시글 북마크 취소", security=@SecurityRequirement(name="bearerAuth"))
    @DeleteMapping("/posts/{postId}/bookmark")
    public BookmarkResponse unbookmark(@PathVariable Long postId) { return postService.bookmark(authenticationFacade.requireUserId(), postId, false); }

    @Operation(summary="게시글 신고", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/posts/{postId}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public ReportResponse report(@PathVariable Long postId, @Valid @RequestBody ReportRequest request) {
        return postService.report(authenticationFacade.requireUserId(), postId, request);
    }

    @Operation(summary="게시글 관심 없음", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/posts/{postId}/hidden")
    public HiddenResponse hidden(@PathVariable Long postId) { return postService.hidden(authenticationFacade.requireUserId(), postId, true); }
    @Operation(summary="게시글 관심 없음 취소", security=@SecurityRequirement(name="bearerAuth"))
    @DeleteMapping("/posts/{postId}/hidden")
    public HiddenResponse unhidden(@PathVariable Long postId) { return postService.hidden(authenticationFacade.requireUserId(), postId, false); }

    @Operation(summary="팔로잉 피드", security=@SecurityRequirement(name="bearerAuth"))
    @GetMapping("/posts/following")
    public CursorPageResponse<PostResponse> following(@RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue="LATEST") String sort) {
        return postService.following(authenticationFacade.requireUserId(), cursor, size, sort);
    }

    @Operation(summary="내가 작성한 게시글", security=@SecurityRequirement(name="bearerAuth"))
    @GetMapping("/users/me/posts")
    public CursorPageResponse<PostResponse> mine(@RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size,
            @RequestParam(defaultValue="ALL") String status) {
        return postService.mine(authenticationFacade.requireUserId(), cursor, size, status);
    }

    @Operation(summary="다른 회원 게시글 목록", description="인증 선택, 본인 userId 요청은 오류")
    @GetMapping("/users/{userId}/posts")
    public CursorPageResponse<PostResponse> byUser(@PathVariable Long userId,
            @RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        return postService.byUser(authenticationFacade.optionalUserId().orElse(null), userId, cursor, size);
    }

    @Operation(summary="북마크한 게시글", security=@SecurityRequirement(name="bearerAuth"))
    @GetMapping("/users/me/bookmarked-posts")
    public CursorPageResponse<PostResponse> bookmarks(@RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        return postService.bookmarks(authenticationFacade.requireUserId(), cursor, size);
    }

    @Operation(summary="텍스트·이미지 게시글 검색", description="검색/임베딩 서비스 연결 전에는 501을 반환합니다. 이미지 입력은 업로드 완료 objectKey입니다.", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/posts/search")
    public CursorPageResponse<SearchItem> search(@Valid @RequestBody SearchRequest request,
            @RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        authenticationFacade.requireUserId();
        boolean noText = request.textQuery() == null || request.textQuery().isBlank();
        boolean noImage = request.imageObjectKey() == null || request.imageObjectKey().isBlank();
        if (noText && noImage) throw new BusinessException(ErrorCode.SEARCH_INPUT_REQUIRED);
        throw new FeatureNotImplementedException();
    }
}
