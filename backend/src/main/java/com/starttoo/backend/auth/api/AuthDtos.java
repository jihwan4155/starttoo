package com.starttoo.backend.auth.api;

import com.starttoo.backend.user.domain.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SocialLoginRequest(
            @Schema(description = "OAuth provider code", example = "KAKAO",
                    allowableValues = {"GOOGLE", "KAKAO"})
            @NotBlank @Size(max = 20) String provider,
            @Schema(description = "Authorization code received by the frontend OAuth callback")
            @NotBlank @Size(max = 4096) String authorizationCode,
            @Schema(description = "Redirect URI used to receive the authorization code",
                    example = "https://i15d201.p.ssafy.io/oauth/callback/kakao")
            @NotBlank @Size(max = 512) String redirectUri
    ) {
    }

    public record SocialLoginResponse(
            boolean signupRequired,
            String signupToken,
            TokenResponse tokens
    ) {
    }

    public record SignupRequest(
            @Schema(description = "Signup token returned by social login when signupRequired is true")
            @NotBlank @Size(max = 4096) String signupToken,
            @Schema(description = "Phone verification token returned by confirmation API")
            @NotBlank @Size(max = 100) String phoneVerificationToken,
            @Schema(description = "Nickname: Korean letters, English letters, and digits, 2-20 chars",
                    example = "starttoo1")
            @NotBlank
            @Pattern(regexp = "^[\\uAC00-\\uD7A3A-Za-z0-9]{2,20}$")
            String nickname,
            @Schema(description = "Optional birth date", example = "1998-05-21")
            LocalDate birthDate,
            @Schema(description = "Optional gender code", example = "M",
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
            @Schema(description = "Refresh token")
            @NotBlank @Size(max = 512) String refreshToken
    ) {
    }

    public record LogoutRequest(
            @Schema(description = "Refresh token to revoke")
            @NotBlank @Size(max = 512) String refreshToken
    ) {
    }

    public record PhoneVerificationRequest(
            @Schema(description = "Korean phone number. Hyphens/spaces are allowed.",
                    example = "010-1234-5678")
            @NotBlank @Size(max = 30) String phoneNumber
    ) {
    }

    public record PhoneVerificationConfirmRequest(
            @Schema(description = "Request id returned by phone verification request")
            @NotBlank @Size(max = 64) String requestId,
            @Schema(description = "6-digit verification code", example = "123456")
            @NotBlank @Pattern(regexp = "^[0-9]{6}$") String code
    ) {
    }

    public record NicknameAvailabilityResponse(String nickname, boolean available) {
    }

    public record LocalLoginRequest(
            @Schema(description = "Existing local test user id. Omit to create a new test user.")
            Integer userSeq,
            @Schema(description = "Nickname for a new local test user", example = "testuser1")
            @Pattern(regexp = "^[\\uAC00-\\uD7A3A-Za-z0-9]{2,20}$") String nickname,
            @Schema(description = "Phone number for a new local test user", example = "01012345678")
            @Size(max = 30) String phoneNumber,
            @Schema(description = "Test role", example = "USER")
            UserRole role
    ) {
    }
}
