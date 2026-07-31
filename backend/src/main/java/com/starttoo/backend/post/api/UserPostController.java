package com.starttoo.backend.post.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.post.application.PostService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/v1/users/{userSeq}/posts")
@RequiredArgsConstructor
@Tag(name = "Posts", description = "게시물, 반응, 체류 점수, 신고")
public class UserPostController {

    private final PostService postService;

    @GetMapping
    @OptionalAuth
    @Operation(
            summary = "회원별 게시물 목록",
            description = """
                    대상이 ACTIVE 일반·아티스트 회원이고 조회자와 차단 관계가 없는 경우에만
                    PUBLISHED 활성 게시물을 postSeq 내림차순 커서로 반환한다. 비활성·ADMIN
                    회원 또는 차단 관계는 회원을 찾을 수 없는 것으로 처리한다.
                    """
    )
    public ApiResponse<CursorPageResponse<PostDtos.PostResponse>> list(
            @PathVariable Integer userSeq,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication authentication
    ) {
        return ApiResponse.of(postService.byUser(
                userSeq,
                cursor,
                size,
                optionalUserSeq(authentication)
        ));
    }

    private Integer optionalUserSeq(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return Integer.valueOf(jwt.getToken().getSubject());
        }
        return null;
    }
}
