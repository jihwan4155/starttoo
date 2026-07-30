package com.starttoo.backend.tattoo.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.tattoo.application.TattooService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/v1/tattoo-designs")
@RequiredArgsConstructor
@Tag(name = "Tattoo Designs", description = "공개 타투 도안 목록")
public class TattooDesignController {

    private final TattooService tattooService;

    @GetMapping
    @OptionalAuth
    @Operation(
            summary = "공개 타투 도안 목록 조회",
            description = """
                    활성 tattoo_designs와 비삭제 타투·이미지를 도안 등록 시각 내림차순 커서로
                    조회한다. 이미지 URL과 Subject, 로그인 회원의 archivedByMe는 일괄 조회해
                    조립하며 원본이 아닌 가공 도안 이미지의 단기 Presigned GET URL을 반환한다.
                    """
    )
    public ApiResponse<CursorPageResponse<TattooDtos.TattooDesignResponse>> list(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication authentication
    ) {
        return ApiResponse.of(tattooService.designs(
                optionalUserSeq(authentication),
                cursor,
                size
        ));
    }

    private Integer optionalUserSeq(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return Integer.valueOf(jwt.getToken().getSubject());
        }
        return null;
    }
}
