package com.starttoo.backend.post.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.post.application.PostService;
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
@RequestMapping("/v1/posts")
@RequiredArgsConstructor
@Tag(name = "Posts", description = "게시물, 반응, 체류 점수, 신고")
public class PostController {

    private final PostService postService;

    @PostMapping
    @Operation(
            summary = "게시물과 이미지 연결 등록",
            description = """
                    중복되지 않은 1~10개의 imageSeq가 현재 회원 소유인지 확인하고 각 이미지의
                    타투 판별·분석이 동기로 모두 끝날 때까지 기다린다. 이 외부 모델 호출 동안에는
                    DB 쓰기 트랜잭션을 열지 않는다. 비타투 이미지도 게시물에는 사용할 수 있으며,
                    타투로 판별된 이미지에 대해서만 tattoos와 subjects 연결을 만든다. 판별 완료 후
                    PUBLISHED 게시물과 모든 postImages를 하나의 짧은 DB 트랜잭션으로 저장한다.
                    모델 장애·시간 초과 또는 저장 실패 시 게시물은 생성되지 않는다. 응답은 DB 커밋 후
                    반환하며 이미지 URL은 저장된 MinIO
                    object key로 생성한 단기 Presigned GET URL이다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.PostResponse> create(
            @Valid @RequestBody PostDtos.CreatePostRequest request
    ) {
        return ApiResponse.of(postService.create(SecurityUtils.currentUserSeq(), request));
    }

    @GetMapping
    @OptionalAuth
    @Operation(
            summary = "게시물 피드",
            description = """
                    postSeq 내림차순 커서로 PUBLISHED이면서 소프트 삭제되지 않은 게시물만 반환한다.
                    authorSeq가 있으면 특정 작성자로 필터링한다. 로그인한 조회자에게는 양방향 차단
                    관계와 관심 없음으로 숨긴 게시물을 제외하고 좋아요·북마크 상태를 계산한다.
                    비로그인 조회도 가능하다. 이미지 URL은 단기 Presigned GET URL이다.
                    """
    )
    public ApiResponse<CursorPageResponse<PostDtos.PostResponse>> list(
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            @RequestParam(required = false) Integer authorSeq,
            Authentication authentication
    ) {
        return ApiResponse.of(postService.list(
                cursor,
                size,
                authorSeq,
                optionalUserSeq(authentication)
        ));
    }

    @GetMapping("/me")
    @Operation(
            summary = "내 게시물 목록",
            description = """
                    현재 회원이 작성한 PUBLISHED 활성 게시물만 postSeq 내림차순 커서로 반환한다.
                    작성자·이미지·관계 상태는 공통 Post DTO를 사용한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CursorPageResponse<PostDtos.PostResponse>> mine(
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(postService.mine(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @GetMapping("/bookmarked")
    @Operation(
            summary = "북마크한 게시물 목록",
            description = """
                    현재 회원의 북마크 저장 시각과 postSeq 내림차순의 안정적인 커서로 조회한다.
                    PUBLISHED 활성 게시물만 반환하며 차단 관계와 관심 없음 게시물을 제외한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CursorPageResponse<PostDtos.PostResponse>> bookmarked(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(postService.bookmarked(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @GetMapping("/following")
    @Operation(
            summary = "팔로잉 게시물 피드",
            description = """
                    현재 회원이 팔로우하는 활성 회원의 PUBLISHED 게시물을 postSeq 내림차순
                    커서로 반환한다. 차단 관계와 관심 없음 게시물은 제외한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CursorPageResponse<PostDtos.PostResponse>> following(
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(postService.following(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @GetMapping("/{postSeq}")
    @OptionalAuth
    @Operation(
            summary = "게시물 상세",
            description = """
                    PUBLISHED 상태의 활성 게시물과 순서가 보장된 이미지·tattooSeq를 반환한다.
                    로그인한 조회자와 작성자 사이에 차단 관계가 있으면 존재하지 않는 게시물처럼
                    처리하며, 조회자의 관심 없음 게시물도 제외한다. 조회자의 좋아요·북마크 상태와
                    작성자 프로필·게시물 이미지의 단기 Presigned GET URL을 포함한다.
                    """
    )
    public ApiResponse<PostDtos.PostResponse> get(
            @PathVariable Long postSeq,
            Authentication authentication
    ) {
        return ApiResponse.of(postService.get(postSeq, optionalUserSeq(authentication)));
    }

    @PatchMapping("/{postSeq}")
    @Operation(
            summary = "게시물 내용 수정",
            description = """
                    작성자만 게시물 본문을 수정할 수 있다. 이미지와 분석 결과는 이 API에서
                    교체하지 않으며, 본문과 수정자·수정 시각만 부분 UPDATE한다. likeCount,
                    commentCount, reportCount는 갱신 대상에 포함하지 않아 동시 증감 결과를
                    덮어쓰지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.PostResponse> update(
            @PathVariable Long postSeq,
            @Valid @RequestBody PostDtos.UpdatePostRequest request
    ) {
        return ApiResponse.of(postService.update(
                SecurityUtils.currentUserSeq(),
                postSeq,
                request
        ));
    }

    @DeleteMapping("/{postSeq}")
    @Operation(
            summary = "게시물 작성자 삭제",
            description = """
                    작성자만 삭제할 수 있다. postStatus를 DELETED로 바꾸고 isDeleted=true,
                    modUsrSeq=작성자로 기록하는 부분 UPDATE 방식의 소프트 삭제다. 세 카운터 열은
                    갱신하지 않으며, 일반 조회는 PUBLISHED만 노출하므로 삭제 즉시 피드와 상세에서
                    제외된다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<Boolean> delete(@PathVariable Long postSeq) {
        postService.delete(SecurityUtils.currentUserSeq(), postSeq);
        return ApiResponse.of(true);
    }

    @PutMapping("/{postSeq}/like")
    @Operation(
            summary = "게시물 좋아요",
            description = """
                    postLikes를 ON CONFLICT DO NOTHING으로 생성하고, 실제 신규 생성된 경우에만
                    게시물 likeCount를 원자적 증감식으로 +1 한다. 동시에 게시물 이미지의 주
                    스타일·색상 취향 점수를 가산한다. 게시물 좋아요 알림은 생성하지 않는다. 모든 DB 변경은
                    하나의 트랜잭션이며 반복 요청은 카운트와 점수를 중복 반영하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.StateResponse> like(@PathVariable Long postSeq) {
        return ApiResponse.of(new PostDtos.StateResponse(
                postService.setLike(
                        SecurityUtils.currentUserSeq(),
                        postSeq,
                        true
                )
        ));
    }

    @DeleteMapping("/{postSeq}/like")
    @Operation(
            summary = "게시물 좋아요 해제",
            description = """
                    postLikes 관계를 멱등하게 삭제한다. 실제 삭제된 경우에만 게시물 likeCount를
                    원자적으로 -1 한다. 좋아요 시 반영된 취향 점수는 행동 이력으로 유지하며
                    역보정하지 않는다. 반복 요청은 카운트를 중복 변경하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.StateResponse> unlike(@PathVariable Long postSeq) {
        return ApiResponse.of(new PostDtos.StateResponse(
                postService.setLike(
                        SecurityUtils.currentUserSeq(),
                        postSeq,
                        false
                )
        ));
    }

    @PutMapping("/{postSeq}/bookmark")
    @Operation(
            summary = "게시물 북마크",
            description = """
                    북마크 행을 멱등하게 생성한다. 실제로 새 관계가 생성된 경우에만 게시물의
                    주 스타일·색상 취향 점수를 가산하며 관계와 점수 변경은 같은 트랜잭션에서
                    처리한다. 반복 요청은 점수를 중복 반영하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.StateResponse> bookmark(@PathVariable Long postSeq) {
        return ApiResponse.of(new PostDtos.StateResponse(
                postService.setBookmark(
                        SecurityUtils.currentUserSeq(),
                        postSeq,
                        true
                )
        ));
    }

    @DeleteMapping("/{postSeq}/bookmark")
    @Operation(
            summary = "게시물 북마크 해제",
            description = """
                    북마크 행을 멱등하게 삭제한다. 북마크 시 반영된 취향 점수는 행동 이력으로
                    유지하며 역보정하지 않는다. 반복 요청도 enabled=false로 성공한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.StateResponse> removeBookmark(@PathVariable Long postSeq) {
        return ApiResponse.of(new PostDtos.StateResponse(
                postService.setBookmark(
                        SecurityUtils.currentUserSeq(),
                        postSeq,
                        false
                )
        ));
    }

    @PutMapping("/{postSeq}/not-interested")
    @Operation(
            summary = "관심 없는 게시물 설정",
            description = """
                    사용자별 숨김 관계를 멱등하게 생성하여 이후 피드에서 제외한다. 실제로 새
                    관계가 생성된 경우에만 게시물의 주 스타일·색상 취향 점수에 음수 가중치를
                    반영하며 반복 요청은 추가 점수를 만들지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.StateResponse> notInterested(@PathVariable Long postSeq) {
        return ApiResponse.of(new PostDtos.StateResponse(
                postService.setNotInterested(
                        SecurityUtils.currentUserSeq(),
                        postSeq,
                        true
                )
        ));
    }

    @DeleteMapping("/{postSeq}/not-interested")
    @Operation(
            summary = "관심 없는 게시물 설정 해제",
            description = """
                    사용자별 숨김 관계를 멱등하게 삭제하여 게시물이 다시 피드 후보가 되도록 한다.
                    설정 시 반영된 취향 점수 감점은 행동 이력으로 유지하며 해제 시 역보정하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.StateResponse> clearNotInterested(@PathVariable Long postSeq) {
        return ApiResponse.of(new PostDtos.StateResponse(
                postService.setNotInterested(
                        SecurityUtils.currentUserSeq(),
                        postSeq,
                        false
                )
        ));
    }

    @PostMapping("/{postSeq}/dwell")
    @Operation(
            summary = "게시물 체류시간 점수 반영",
            description = """
                    프론트엔드가 계산한 체류 초를 3초 미만, 3~9초, 10~29초, 30초 이상의 구간으로
                    점수화한다. 원본 체류시간이나 사용자×게시물 통계 행은 저장하지 않고 게시물의
                    주 스타일·색상 누적 점수만 즉시 갱신한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<Boolean> dwell(
            @PathVariable Long postSeq,
            @Valid @RequestBody PostDtos.DwellRequest request
    ) {
        postService.recordDwell(SecurityUtils.currentUserSeq(), postSeq, request.seconds());
        return ApiResponse.of(true);
    }

    @PostMapping("/{postSeq}/reports")
    @Operation(
            summary = "게시물 신고",
            description = """
                    PUBLISHED 게시물에 회원당 한 번만 신고할 수 있다. PENDING 신고 행 생성과
                    posts.reportCount의 원자적 증가를 같은 트랜잭션에서 처리한다. 관리자가
                    ACCEPTED로 처리하기 전까지 게시물 노출 상태는 바뀌지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<PostDtos.ReportResponse> report(
            @PathVariable Long postSeq,
            @Valid @RequestBody PostDtos.ReportRequest request
    ) {
        return ApiResponse.of(postService.report(
                SecurityUtils.currentUserSeq(),
                postSeq,
                request
        ));
    }

    private Integer optionalUserSeq(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return Integer.valueOf(jwt.getToken().getSubject());
        }
        return null;
    }
}
