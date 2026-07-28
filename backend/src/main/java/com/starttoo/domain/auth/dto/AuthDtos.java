package com.starttoo.domain.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SocialLoginRequest(
            @NotBlank @Pattern(regexp = "GOOGLE|KAKAO")
            @Schema(description = "소셜 로그인 제공자", allowableValues = {"GOOGLE", "KAKAO"}, example = "KAKAO") String provider,
            @NotBlank @Schema(description = "소셜 로그인 Redirect에서 받은 일회성 인가 코드", example = "authorization-code") String authorizationCode,
            @NotBlank @Schema(description = "인가 코드 발급에 사용한 Redirect URI. 서버 허용 목록과 완전히 일치해야 함", example = "http://localhost:3000/oauth/callback") String redirectUri,
            @NotBlank @Pattern(regexp = "WEB|ANDROID|IOS")
            @Schema(description = "로그인 클라이언트 플랫폼", allowableValues = {"WEB", "ANDROID", "IOS"}, example = "WEB") String platform,
            @Schema(description = "선택적인 FCM/APNs/Web Push 토큰", example = "push-token") String pushToken
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SocialLoginResponse(
            boolean registrationRequired,
            String accessToken,
            String refreshToken,
            String tokenType,
            Long expiresIn,
            UserSummary user,
            String signupToken,
            SocialProfileResponse socialProfile
    ) {
    }

    public record SocialProfileResponse(String provider, String email) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record UserSummary(
            Long userId,
            String nickname,
            String role,
            String accountStatus,
            String profileImageUrl,
            ArtistSummary artist
    ) {
    }

    public record ArtistSummary(String approvalStatus) {
    }

    public record SignupRequest(
            @NotBlank @Schema(description = "미가입 소셜 로그인 응답에서 받은 단기 회원가입 토큰") String signupToken,
            @NotBlank @Size(min = 2, max = 50) @Schema(description = "trim 후 2~50자의 미중복 닉네임", example = "needlemoon") String nickname,
            @NotBlank @Pattern(regexp = "USER|ARTIST")
            @Schema(description = "가입 역할", allowableValues = {"USER", "ARTIST"}, example = "USER") String role,
            @Schema(description = "생년월일", example = "1998-04-12") LocalDate birthDate,
            @Pattern(regexp = "MALE|FEMALE|OTHER|UNSPECIFIED")
            @Schema(description = "성별", allowableValues = {"MALE", "FEMALE", "OTHER", "UNSPECIFIED"}, example = "UNSPECIFIED") String gender,
            @Size(max = 1000)
            @Schema(
                    description = "선택한 프로필 이미지의 업로드 완료 objectKey. 생략하면 서버 기본 이미지 key를 사용",
                    example = "profiles/signup/550e8400-e29b-41d4-a716-446655440000.webp"
            )
            String profileImageKey,
            @Valid @Schema(description = "ARTIST 가입 시 선택적으로 저장할 숍 프로필") ArtistProfileRequest artistProfile
    ) {
    }

    public record SignupProfileUploadRequest(
            @NotBlank
            @Schema(description = "미가입 소셜 로그인 응답에서 받은 단기 회원가입 토큰")
            String signupToken,
            @NotBlank
            @Schema(
                    description = "업로드할 실제 이미지 MIME",
                    allowableValues = {"image/jpeg", "image/png", "image/webp"},
                    example = "image/webp"
            )
            String contentType,
            @Min(1)
            @Max(10_485_760)
            @Schema(description = "업로드할 파일 크기(byte), 최대 10MB", example = "1852043")
            long fileSize
    ) {
    }

    public record ArtistProfileRequest(
            @Size(max = 100) String shopName,
            @Size(max = 30) String shopCity,
            @Size(max = 500) String shopAddress,
            @Size(max = 30) String shopPhone,
            @Size(max = 500) String businessHours
    ) {
    }

    public record TokenResponse(
            String accessToken,
            String refreshToken,
            String tokenType,
            long expiresIn,
            UserSummary user
    ) {
    }

    public record RefreshRequest(@Schema(description = "앱에서 사용하는 Refresh Token. 웹은 HttpOnly 쿠키 사용") String refreshToken) {
    }

    public record RefreshResponse(
            String accessToken,
            String refreshToken,
            String tokenType,
            long expiresIn
    ) {
    }

    public record LogoutRequest(@Schema(description = "앱에서 폐기할 Refresh Token. 웹은 HttpOnly 쿠키 사용") String refreshToken) {
    }

    public record WithdrawalRequest(
            @Size(max = 255) @Schema(example = "서비스를 더 이상 사용하지 않음") String reason
    ) {
    }
}
