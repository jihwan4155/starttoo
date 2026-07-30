package com.starttoo.backend.auth.api;

import com.starttoo.backend.auth.application.AuthService;
import com.starttoo.backend.auth.application.PhoneNumberNormalizer;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.user.domain.UserRole;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@Profile("local")
@ConditionalOnProperty(name = "app.test-auth.enabled", havingValue = "true")
@RestController
@RequestMapping("/v1/test/auth")
@RequiredArgsConstructor
@Tag(name = "Local Test Auth", description = "local 프로필 전용 인증")
public class LocalTestAuthController {

    private final UserRepository userRepository;
    private final AuthService authService;
    private final PhoneNumberNormalizer phoneNumberNormalizer;
    private final JdbcTemplate jdbcTemplate;
    private final SearchIndexEventPublisher searchIndexEventPublisher;

    @PostMapping("/login")
    @Transactional
    @Operation(
            summary = "로컬 테스트 회원 생성 또는 토큰 발급",
            description = """
                    local 프로필에서만 노출된다. userSeq가 있으면 기존 회원 상태를 확인하여 토큰을
                    발급한다. userSeq가 없으면 닉네임과 한국 휴대폰 번호를 검증하고 users 행과
                    최초 ACTIVE 상태 이력을 하나의 트랜잭션으로 만든 뒤 토큰을 발급한다.
                    OAuth·SMS 제공자 없이 Swagger 인증을 시험하기 위한 전용 API다.
                    """
    )
    public ApiResponse<AuthDtos.TokenResponse> login(
            @Valid @RequestBody AuthDtos.LocalLoginRequest request
    ) {
        User user = request.userSeq() == null ? createTestUser(request) : userRepository
                .findByUserSeqAndDeletedFalse(request.userSeq())
                .orElseThrow(() -> BusinessException.of(ErrorCode.USER_NOT_FOUND));
        return ApiResponse.of(authService.issueForLocalUser(user));
    }

    private User createTestUser(AuthDtos.LocalLoginRequest request) {
        if (request.nickname() == null || request.phoneNumber() == null) {
            throw new BusinessException(
                    ErrorCode.INVALID_REQUEST,
                    "userSeq가 없으면 nickname과 phoneNumber가 필요합니다."
            );
        }
        if (userRepository.existsByNicknameAndDeletedFalse(request.nickname())) {
            throw BusinessException.of(ErrorCode.DUPLICATE_NICKNAME);
        }
        String phone = phoneNumberNormalizer.normalizeKorean(request.phoneNumber());
        if (userRepository.existsByPhoneNumberAndDeletedFalse(phone)) {
            throw BusinessException.of(ErrorCode.DUPLICATE_PHONE_NUMBER);
        }
        OffsetDateTime now = OffsetDateTime.now();
        User user = userRepository.saveAndFlush(User.builder()
                .nickname(request.nickname())
                .phoneNumber(phone)
                .phoneVerifiedDttm(now)
                .role(request.role() == null ? UserRole.USER : request.role())
                .recentSearchTerms(new String[0])
                .accountStatus(AccountStatus.ACTIVE)
                .statusChangedDttm(now)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build());
        user.initializeModifier();
        userRepository.flush();
        jdbcTemplate.update("""
                INSERT INTO user_account_status_histories (
                    user_seq, previous_status, changed_status, reason_type, reg_usr_seq
                ) VALUES (?, NULL, 'ACTIVE', 'SIGNUP', ?)
                """, user.getUserSeq(), user.getUserSeq());
        searchIndexEventPublisher.accountChanged(user.getUserSeq());
        return user;
    }
}
