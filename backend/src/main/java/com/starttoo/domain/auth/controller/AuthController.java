package com.starttoo.domain.auth.controller;

import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.auth.dto.AuthDtos.LogoutRequest;
import com.starttoo.domain.auth.dto.AuthDtos.RefreshRequest;
import com.starttoo.domain.auth.dto.AuthDtos.RefreshResponse;
import com.starttoo.domain.auth.dto.AuthDtos.SignupRequest;
import com.starttoo.domain.auth.dto.AuthDtos.SignupProfileUploadRequest;
import com.starttoo.domain.auth.dto.AuthDtos.SocialLoginRequest;
import com.starttoo.domain.auth.dto.AuthDtos.SocialLoginResponse;
import com.starttoo.domain.auth.dto.AuthDtos.TokenResponse;
import com.starttoo.domain.auth.service.AuthService;
import com.starttoo.domain.image.dto.UploadDtos.PresignedUploadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@Tag(name = "Auth", description = "소셜 로그인·가입·JWT 재발급·로그아웃")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/auth")
public class AuthController {

    private static final String REFRESH_COOKIE = "refreshToken";

    private final AuthService authService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary = "카카오·구글 소셜 로그인")
    @PostMapping("/social/login")
    public ResponseEntity<SocialLoginResponse> login(
            @Valid @RequestBody SocialLoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        var result = authService.login(request);
        if ("WEB".equals(result.platform()) && result.refreshToken() != null) {
            setRefreshCookie(servletResponse, result.refreshToken(), servletRequest.isSecure());
        }
        return ResponseEntity.ok(result.response());
    }

    @Operation(summary = "역할 기반 회원가입")
    @PostMapping("/signup")
    public ResponseEntity<TokenResponse> signup(
            @Valid @RequestBody SignupRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        var result = authService.signup(request);
        if ("WEB".equals(result.platform())) {
            setRefreshCookie(servletResponse, result.refreshToken(), servletRequest.isSecure());
        }
        return ResponseEntity.status(201).body(result.response());
    }

    @Operation(
            summary = "회원가입 프로필 이미지 Presigned URL 발급",
            description = "Access Token 발급 전 signupToken으로 프로필 이미지 업로드 URL과 objectKey를 발급합니다."
    )
    @PostMapping("/signup/profile-image/presigned-url")
    public PresignedUploadResponse signupProfileUpload(
            @Valid @RequestBody SignupProfileUploadRequest request
    ) {
        var result = authService.createSignupProfileUpload(request);
        return new PresignedUploadResponse(
                result.objectKey(),
                result.uploadUrl(),
                result.method(),
                result.contentType(),
                result.expiresAt()
        );
    }

    @Operation(summary = "Access Token 재발급")
    @PostMapping("/token/refresh")
    public ResponseEntity<RefreshResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String cookieToken,
            @RequestBody(required = false) RefreshRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        boolean webCookieRequest = cookieToken != null && !cookieToken.isBlank();
        String rawToken = webCookieRequest
                ? cookieToken
                : request == null ? null : request.refreshToken();
        var result = authService.refresh(rawToken);
        if (webCookieRequest) {
            setRefreshCookie(servletResponse, result.refreshToken(), servletRequest.isSecure());
            var body = result.response();
            return ResponseEntity.ok(new RefreshResponse(
                    body.accessToken(), null, body.tokenType(), body.expiresIn()
            ));
        }
        return ResponseEntity.ok(result.response());
    }

    @Operation(summary = "로그아웃", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String cookieToken,
            @RequestBody(required = false) LogoutRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        String rawToken = cookieToken != null
                ? cookieToken
                : request == null ? null : request.refreshToken();
        authService.logout(authenticationFacade.requireUserId(), rawToken);
        expireRefreshCookie(servletResponse, servletRequest.isSecure());
        return ResponseEntity.noContent().build();
    }

    private void setRefreshCookie(HttpServletResponse response, String token, boolean secure) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, token)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/v1/auth")
                .maxAge(Duration.ofDays(30))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void expireRefreshCookie(HttpServletResponse response, boolean secure) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/v1/auth")
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
