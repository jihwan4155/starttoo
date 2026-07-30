package com.starttoo.backend.auth.api;

import com.starttoo.backend.auth.application.AuthService;
import com.starttoo.backend.auth.application.PhoneVerificationService;
import com.starttoo.backend.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static com.starttoo.backend.auth.api.AuthDtos.*;

@Validated
@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "OAuth login, signup, phone verification, and tokens")
public class AuthController {

    private final AuthService authService;
    private final PhoneVerificationService phoneVerificationService;

    @PostMapping("/social/login")
    @Operation(
            summary = "Social login with OAuth authorization code",
            description = """
                    Exchanges the frontend OAuth authorization code for a provider access token,
                    loads the Google or Kakao subject, and issues Starttoo tokens for an existing
                    active account. If the OAuth account is not linked yet, returns a short-lived
                    signup token without creating a users row.
                    """
    )
    public ApiResponse<SocialLoginResponse> socialLogin(
            @Valid @RequestBody SocialLoginRequest request
    ) {
        return ApiResponse.of(authService.socialLogin(request));
    }

    @PostMapping("/signup")
    @Operation(
            summary = "Create unified account or link OAuth account",
            description = """
                    Validates and consumes a signup token and one-time phone verification token.
                    If a user with the same active phone number exists, only links the OAuth
                    account. Otherwise creates users, user_oauth_accounts, and the initial ACTIVE
                    status history in one database transaction.
                    """
    )
    public ApiResponse<TokenResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ApiResponse.of(authService.signup(request));
    }

    @PostMapping("/token/refresh")
    @Operation(
            summary = "Rotate access and refresh tokens",
            description = """
                    Looks up the refresh token by SHA-256 hash, verifies expiry and account status,
                    revokes the old token, and stores a new token pair in one database transaction.
                    """
    )
    public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.of(authService.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    @Operation(
            summary = "Logout and deactivate current device push token",
            description = """
                    Revokes the refresh token by hash. If the token is linked to a device, the
                    device is deactivated in the same transaction so previous account notifications
                    are no longer delivered to that device.
                    """
    )
    public ApiResponse<Boolean> logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request.refreshToken());
        return ApiResponse.of(true);
    }

    @PostMapping("/phone/verifications")
    @Operation(
            summary = "Request phone verification code",
            description = """
                    Normalizes a Korean phone number, stores a 6-digit code in Redis for 3 minutes,
                    and sends it through the configured SMS gateway.
                    """
    )
    public ApiResponse<PhoneVerificationService.VerificationRequested> requestPhoneVerification(
            @Valid @RequestBody PhoneVerificationRequest request
    ) {
        return ApiResponse.of(phoneVerificationService.request(request.phoneNumber()));
    }

    @PostMapping("/phone/verifications/confirm")
    @Operation(
            summary = "Confirm phone verification code",
            description = """
                    Validates the request id and 6-digit code from Redis, deletes the code on
                    success, and returns a one-time phone verification token for signup.
                    """
    )
    public ApiResponse<PhoneVerificationService.VerificationConfirmed> confirmPhoneVerification(
            @Valid @RequestBody PhoneVerificationConfirmRequest request
    ) {
        return ApiResponse.of(phoneVerificationService.confirm(request.requestId(), request.code()));
    }

    @GetMapping("/nicknames/availability")
    @Operation(
            summary = "Check nickname availability",
            description = """
                    Validates that the nickname is 2-20 Korean letters, English letters, or digits,
                    then returns whether it is available among non-deleted users.
                    """
    )
    public ApiResponse<NicknameAvailabilityResponse> nicknameAvailability(
            @RequestParam
            @Pattern(regexp = "^[\\uAC00-\\uD7A3A-Za-z0-9]{2,20}$")
            String nickname
    ) {
        return ApiResponse.of(new NicknameAvailabilityResponse(
                nickname,
                authService.nicknameAvailable(nickname)
        ));
    }
}
