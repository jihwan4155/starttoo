package com.starttoo.domain.auth.controller;

import com.starttoo.common.openapi.CommonApiResponses;
import com.starttoo.domain.auth.dto.TestAuthDtos.TestLoginRequest;
import com.starttoo.domain.auth.dto.TestAuthDtos.TestLoginResponse;
import com.starttoo.domain.auth.service.TestAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Test Auth", description = "로컬 개발 전용 JWT 발급")
@RestController
@CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/test/auth")
@Profile("local")
@ConditionalOnProperty(prefix = "app.test-auth", name = "enabled", havingValue = "true")
public class TestAuthController {

    private final TestAuthService testAuthService;

    @Operation(
            summary = "테스트 로그인",
            description = "소셜 로그인을 생략하고 DB에 존재하는 활성 회원의 역할로 Access Token을 발급합니다. "
                    + "local 프로필에서만 사용할 수 있으며 Refresh Token은 발급하지 않습니다."
    )
    @PostMapping("/login")
    public ResponseEntity<TestLoginResponse> login(
            @Valid @RequestBody TestLoginRequest request
    ) {
        return ResponseEntity.ok(testAuthService.login(request.userId()));
    }
}
