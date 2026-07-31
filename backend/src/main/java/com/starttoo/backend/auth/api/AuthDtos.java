package com.starttoo.backend.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SocialLoginRequest(
            @Schema(description = "OAuth 제공자 코드", example = "KAKAO",
                    allowableValues = {"GOOGLE", "KAKAO"})
            @NotBlank @Size(max = 20) String provider,
            @Schema(description = "프론트엔드가 OAuth 제공자에서 받은 액세스 토큰",
                    example = "provider-access-token")
            @NotBlank @Size(max = 4096) String accessToken
    ) {
    }

    public record SocialLoginResponse(
            boolean signupRequired,
            String signupToken,
            TokenResponse tokens
    ) {
    }

    public record SignupRequest(
            @Schema(description = "소셜 로그인에서 signupRequired=true일 때 받은 단기 토큰")
            @NotBlank @Size(max = 4096) String signupToken,
            @Schema(description = "한국 휴대폰 번호. 하이픈·공백 제거 후 +82 E.164로 정규화",
                    example = "010-1234-5678")
            @NotBlank @Size(max = 30) String phoneNumber,
            @Schema(description = "공백·특수문자 없는 대소문자 구분 닉네임", example = "검은장미1")
            @NotBlank
            @Pattern(regexp = "^[가-힣A-Za-z0-9]{2,20}$")
            String nickname,
            @Schema(description = "가입 요청 역할", example = "ARTIST",
                    allowableValues = {"USER", "ARTIST"})
            @NotBlank
            @Pattern(regexp = "USER|ARTIST")
            String requestedRole,
            @Schema(description = "선택 생년월일", example = "1998-05-21")
            LocalDate birthDate,
            @Schema(description = "선택 성별 코드", example = "M",
                    allowableValues = {"M", "F"})
            @Pattern(regexp = "M|F")
            String gender
    ) {
    }

    public record TokenResponse(
            String accessToken,
            Instant accessTokenExpiresAt,
            String refreshToken,
            Instant refreshTokenExpiresAt,
            String tokenType
    ) {
    }

    public record RefreshRequest(
            @Schema(description = "로그인 또는 이전 회전에서 받은 리프레시 토큰")
            @NotBlank @Size(max = 512) String refreshToken
    ) {
    }

    public record LogoutRequest(
            @Schema(description = "폐기할 리프레시 토큰")
            @NotBlank @Size(max = 512) String refreshToken
    ) {
    }

    public record NicknameAvailabilityResponse(String nickname, boolean available) {
    }

    public record PhoneAvailabilityResponse(
            String normalizedPhoneNumber,
            @Schema(description = "신규 가입에 사용할 수 있는 번호인지 여부")
            boolean available,
            @Schema(description = "가입된 번호일 때 연결된 OAuth provider 코드",
                    allowableValues = {"GOOGLE", "KAKAO"},
                    nullable = true)
            String provider
    ) {
    }

    public record NicknameSuggestionsResponse(
            @Schema(description = "추천 시점에 활성 회원과 중복되지 않은 닉네임")
            List<String> items
    ) {
    }

}
