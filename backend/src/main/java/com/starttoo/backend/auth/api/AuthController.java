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
@Tag(name = "Auth", description = "OAuth 로그인, 가입, 휴대폰 인증, 토큰")
public class AuthController {

    private final AuthService authService;
    private final PhoneVerificationService phoneVerificationService;

    @PostMapping("/social/login")
    @Operation(
            summary = "소셜 로그인 또는 가입 토큰 발급",
            description = """
                    Google 또는 Kakao 액세스 토큰을 제공자 API로 검증하여 불변 subject를 얻는다.
                    이미 연결된 OAuth 계정이면 마지막 로그인 시각을 갱신하고 ACTIVE 계정에 대한
                    액세스·리프레시 토큰을 발급한다. 연결 계정이 없으면 users 행을 만들지 않고,
                    제공자와 subject가 서명된 단기 가입 토큰만 반환한다.
                    """
    )
    public ApiResponse<SocialLoginResponse> socialLogin(
            @Valid @RequestBody SocialLoginRequest request
    ) {
        return ApiResponse.of(authService.socialLogin(request));
    }

    @PostMapping("/signup")
    @Operation(
            summary = "통합 계정 가입 또는 OAuth 추가 연결",
            description = """
                    가입 토큰과 Redis의 일회성 휴대폰 인증 토큰을 검증·소비한다.
                    같은 활성 휴대폰 번호의 회원이 있으면 신규 users 행을 만들지 않고 OAuth 계정만
                    연결한다. 없으면 users, user_oauth_accounts, 최초 ACTIVE 상태 이력을 하나의
                    DB 트랜잭션으로 저장한 뒤 토큰을 발급한다. 닉네임·전화번호·provider subject
                    중복이 발생하면 DB 변경은 롤백된다. 신규 users 커밋이 성공한 뒤에만 계정
                    자동완성·검색 Redis 인덱스를 증분 갱신한다.
                    """
    )
    public ApiResponse<TokenResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ApiResponse.of(authService.signup(request));
    }

    @PostMapping("/token/refresh")
    @Operation(
            summary = "액세스·리프레시 토큰 회전",
            description = """
                    전달받은 리프레시 토큰을 SHA-256 해시로 조회한다. 만료·폐기 여부와 회원 상태를
                    확인한 후 기존 토큰 폐기와 새 토큰 쌍 저장을 같은 DB 트랜잭션에서 수행한다.
                    이미 사용되었거나 만료된 토큰은 재사용할 수 없다.
                    """
    )
    public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.of(authService.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    @Operation(
            summary = "로그아웃 및 현재 기기 푸시 해제",
            description = """
                    원문 토큰은 저장하지 않고 SHA-256 해시로 찾는다. 아직 폐기되지 않은 토큰이면
                    폐기 시각을 기록한다. 리프레시 토큰에 deviceSeq가 연결되어 있으면 같은
                    트랜잭션에서 userDevices.isActive=false로 바꾸어 로그아웃 후 이전 계정의
                    FCM 알림이 기기로 가지 않게 한다. 클라이언트는 보유 토큰 삭제와 WebSocket
                    연결 종료도 함께 수행해야 한다. 이미 없거나 폐기된 토큰에 대한 반복 호출은
                    성공으로 처리하는 멱등 로그아웃이다.
                    """
    )
    public ApiResponse<Boolean> logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request.refreshToken());
        return ApiResponse.of(true);
    }

    @PostMapping("/phone/verifications")
    @Operation(
            summary = "휴대폰 인증번호 요청",
            description = """
                    입력값의 하이픈과 공백을 제거하고 현재 정책에 따라 한국 E.164 번호로
                    정규화한다. 6자리 코드를 발급하여 Redis에 3분간 저장하고 운영 환경에서는
                    SMS 게이트웨이로 전송한다. local 프로필에서는 실제 발송 대신 debugCode를
                    응답하여 테스트할 수 있다.
                    """
    )
    public ApiResponse<PhoneVerificationService.VerificationRequested> requestPhoneVerification(
            @Valid @RequestBody PhoneVerificationRequest request
    ) {
        return ApiResponse.of(phoneVerificationService.request(request.phoneNumber()));
    }

    @PostMapping("/phone/verifications/confirm")
    @Operation(
            summary = "휴대폰 인증번호 확인",
            description = """
                    Redis에 저장된 요청 ID와 6자리 코드를 검증한다. 성공하면 기존 코드를 즉시
                    삭제하고 가입에서 한 번만 소비할 수 있는 휴대폰 인증 토큰을 10분간 발급한다.
                    """
    )
    public ApiResponse<PhoneVerificationService.VerificationConfirmed> confirmPhoneVerification(
            @Valid @RequestBody PhoneVerificationConfirmRequest request
    ) {
        return ApiResponse.of(phoneVerificationService.confirm(request.requestId(), request.code()));
    }

    @GetMapping("/nicknames/availability")
    @Operation(
            summary = "닉네임 사용 가능 여부",
            description = """
                    한글 완성형, 영문 대소문자, 숫자로 구성된 2~20자 닉네임인지 검증한다.
                    PostgreSQL 일반 VARCHAR 비교를 사용하므로 영문 대소문자를 구분하며,
                    소프트 삭제되지 않은 회원 사이의 중복 여부를 반환한다.
                    """
    )
    public ApiResponse<NicknameAvailabilityResponse> nicknameAvailability(
            @RequestParam
            @Pattern(regexp = "^[가-힣A-Za-z0-9]{2,20}$")
            String nickname
    ) {
        return ApiResponse.of(new NicknameAvailabilityResponse(
                nickname,
                authService.nicknameAvailable(nickname)
        ));
    }
}
