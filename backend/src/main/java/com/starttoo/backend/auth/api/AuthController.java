package com.starttoo.backend.auth.api;

import com.starttoo.backend.auth.application.AuthService;
import com.starttoo.backend.auth.application.OAuthLoginService;
import com.starttoo.backend.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
@Tag(name = "Auth", description = "OAuth 로그인, 통합 계정 가입, 토큰")
public class AuthController {

    private final AuthService authService;
    private final OAuthLoginService oauthLoginService;

    @PostMapping("/social/login")
    @Operation(
            summary = "소셜 로그인 또는 가입 토큰 발급",
            description = """
                    accessToken 또는 authorizationCode 중 하나로 Google·Kakao 계정을 검증한다.
                    네이티브 앱 SDK는 액세스 토큰을 직접 발급받으므로 accessToken을 보낸다.
                    웹은 카카오 JavaScript SDK가 브라우저에 액세스 토큰을 주지 않으므로
                    authorizationCode와 redirectUri를 보내고, 서버가 제공자 토큰 엔드포인트에서
                    액세스 토큰으로 교환한다. 교환에 필요한 클라이언트 키는 서버에만 둔다.
                    확보한 액세스 토큰을 제공자 API로 검증해 불변 subject를 얻는다.
                    이미 연결된 OAuth 계정이면 마지막 로그인 시각을 갱신하고 ACTIVE 계정에 대한
                    액세스·리프레시 토큰을 발급한다. 연결 계정이 없으면 users 행을 만들지 않고,
                    제공자와 subject가 서명된 단기 가입 토큰만 반환한다.
                    두 자격 증명을 함께 보내거나 모두 비우면 400, 만료·재사용된 코드와
                    redirect_uri 불일치, 토큰 거부와 subject 누락은 401,
                    제공자 키 미설정은 503, 제공자 장애는 502, 시간 초과는 504로 구분한다.
                    """
    )
    public ApiResponse<SocialLoginResponse> socialLogin(
            @Valid @RequestBody SocialLoginRequest request
    ) {
        return ApiResponse.of(oauthLoginService.socialLogin(request));
    }

    @PostMapping("/signup")
    @Operation(
            summary = "단일 OAuth 통합 계정 가입",
            description = """
                    가입 토큰을 검증하고 요청의 한국 휴대폰 번호를 +82 E.164로 정규화한다.
                    이미 가입된 활성 휴대폰 번호에는 다른 OAuth 계정을 추가 연결하지 않고
                    DUPLICATE_PHONE_NUMBER를 반환한다. 사용 가능한 번호이면 users,
                    user_oauth_accounts, 최초 ACTIVE 상태 이력을 하나의 DB 트랜잭션으로 저장한 뒤
                    토큰을 발급한다. ARTIST 가입도 users.role은 USER로 만들고 artists 확장 행을
                    UNVERIFIED로 생성한다. ADMIN 가입은 허용하지 않는다. 닉네임·전화번호·provider
                    subject 중복이 발생하면 DB 변경은 롤백된다.
                    가입 토큰은 DB 커밋이 성공한 뒤에만 Redis에서 소비 처리하며, 신규 users 검색
                    인덱스도 커밋 후 갱신한다.
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

    @GetMapping("/nicknames/suggestions")
    @Operation(
            summary = "미중복 닉네임 추천",
            description = """
                    완성형 한글, 영문, 숫자로 구성된 2~20자 후보를 유한 횟수만 생성한다.
                    활성 회원과 중복되지 않은 후보를 반환하며 최종 유일성은 회원가입 트랜잭션의
                    데이터베이스 UNIQUE 제약으로 보장한다.
                    """
    )
    public ApiResponse<NicknameSuggestionsResponse> nicknameSuggestions(
            @RequestParam(defaultValue = "5")
            @Min(1) @Max(10)
            int count
    ) {
        return ApiResponse.of(new NicknameSuggestionsResponse(
                authService.nicknameSuggestions(count)
        ));
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

    @GetMapping("/phones/availability")
    @Operation(
            summary = "휴대폰 번호 사용 가능 여부",
            description = """
                    하이픈과 공백을 제거하고 한국 모바일 E.164 형식으로 정규화한 뒤 탈퇴하지
                    않은 회원의 전화번호와 비교한다. 미가입 번호이면 available=true와
                    provider=null을 반환한다. 가입된 번호이면 available=false와 해당 계정의
                    OAuth provider 코드(GOOGLE 또는 KAKAO)를 반환한다. 탈퇴 회원 번호는 재사용할
                    수 있지만 정지·강퇴 회원 번호는 예약한다. IP와 번호별 Rate Limit을 적용하고
                    최종 유일성은 가입 트랜잭션의 부분 UNIQUE 인덱스로 다시 검증한다.
                    """
    )
    public ApiResponse<PhoneAvailabilityResponse> phoneAvailability(
            @RequestParam
            @NotBlank @Size(max = 30)
            String phoneNumber
    ) {
        return ApiResponse.of(authService.phoneAvailability(phoneNumber));
    }
}
