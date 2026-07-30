package com.starttoo.backend.auth.application;

import com.starttoo.backend.auth.api.AuthDtos;
import com.starttoo.backend.auth.domain.OAuthProvider;
import com.starttoo.backend.auth.domain.OAuthProviderRepository;
import com.starttoo.backend.auth.domain.RefreshToken;
import com.starttoo.backend.auth.domain.RefreshTokenRepository;
import com.starttoo.backend.auth.domain.UserOAuthAccount;
import com.starttoo.backend.auth.domain.UserOAuthAccountRepository;
import com.starttoo.backend.common.config.JwtProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.common.security.JwtConfig.JwtService;
import com.starttoo.backend.common.security.JwtConfig.TokenValue;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.notification.application.DeviceService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final OAuthSubjectResolver subjectResolver;
    private final OAuthProviderRepository providerRepository;
    private final UserOAuthAccountRepository oauthAccountRepository;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PhoneVerificationService phoneVerificationService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final JdbcTemplate jdbcTemplate;
    private final RefreshTokenHasher refreshTokenHasher;
    private final SearchIndexEventPublisher searchIndexEventPublisher;
    private final DeviceService deviceService;
    private final SecureRandom secureRandom = new SecureRandom();

    private final SignupTokenDecoder signupTokenDecoder;

    @Transactional
    public AuthDtos.SocialLoginResponse socialLogin(AuthDtos.SocialLoginRequest request) {
        OAuthSubjectResolver.OAuthSubject subject =
                subjectResolver.resolve(request.provider(), request.accessToken());
        OAuthProvider provider = provider(subject.providerCode());
        return oauthAccountRepository
                .findByOauthProviderSeqAndProviderSubjectAndDeletedFalse(
                        provider.getOauthProviderSeq(),
                        subject.providerSubject()
                )
                .map(account -> {
                    account.recordLogin();
                    User user = activeUser(account.getUserSeq());
                    return new AuthDtos.SocialLoginResponse(false, null, issue(user, null));
                })
                .orElseGet(() -> {
                    TokenValue signup = jwtService.createTypedToken(
                            subject.providerSubject(),
                            "SIGNUP",
                            jwtProperties.signupTokenTtl(),
                            Map.of("provider", subject.providerCode())
                    );
                    return new AuthDtos.SocialLoginResponse(true, signup.value(), null);
                });
    }

    @Transactional
    public AuthDtos.TokenResponse signup(AuthDtos.SignupRequest request) {
        Jwt signupJwt = decodeSignupToken(request.signupToken());
        String providerCode = signupJwt.getClaimAsString("provider");
        String providerSubject = signupJwt.getSubject();
        OAuthProvider provider = provider(providerCode);
        String phoneNumber = phoneVerificationService.consume(request.phoneVerificationToken());

        if (oauthAccountRepository
                .findByOauthProviderSeqAndProviderSubjectAndDeletedFalse(
                        provider.getOauthProviderSeq(),
                        providerSubject
                )
                .isPresent()) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }

        OffsetDateTime now = OffsetDateTime.now();
        try {
            var existingUser = userRepository.findByPhoneNumberAndDeletedFalse(phoneNumber);
            if (existingUser.isPresent()) {
                User user = existingUser.get();
                assertUsable(user);
                oauthAccountRepository.saveAndFlush(UserOAuthAccount.builder()
                        .userSeq(user.getUserSeq())
                        .oauthProviderSeq(provider.getOauthProviderSeq())
                        .providerSubject(providerSubject)
                        .lastLoginDttm(now)
                        .regDttm(now)
                        .modDttm(now)
                        .deleted(false)
                        .build());
                return issue(user, null);
            }
            if (userRepository.existsByNicknameAndDeletedFalse(request.nickname())) {
                throw BusinessException.of(ErrorCode.DUPLICATE_NICKNAME);
            }
            User user = userRepository.saveAndFlush(User.builder()
                    .nickname(request.nickname())
                    .phoneNumber(phoneNumber)
                    .phoneVerifiedDttm(now)
                    .birthDate(request.birthDate())
                    .gender(request.gender())
                    .role(UserRole.USER)
                    .recentSearchTerms(new String[0])
                    .accountStatus(AccountStatus.ACTIVE)
                    .statusChangedDttm(now)
                    .regDttm(now)
                    .modDttm(now)
                    .deleted(false)
                    .build());
            user.initializeModifier();
            userRepository.flush();

            oauthAccountRepository.save(UserOAuthAccount.builder()
                    .userSeq(user.getUserSeq())
                    .oauthProviderSeq(provider.getOauthProviderSeq())
                    .providerSubject(providerSubject)
                    .lastLoginDttm(now)
                    .regDttm(now)
                    .modDttm(now)
                    .deleted(false)
                    .build());

            jdbcTemplate.update("""
                    INSERT INTO user_account_status_histories (
                        user_seq, previous_status, changed_status, reason_type, reg_usr_seq
                    ) VALUES (?, NULL, 'ACTIVE', 'SIGNUP', ?)
                    """, user.getUserSeq(), user.getUserSeq());
            searchIndexEventPublisher.accountChanged(user.getUserSeq());
            return issue(user, null);
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }
    }

    @Transactional
    public AuthDtos.TokenResponse refresh(String rawRefreshToken) {
        OffsetDateTime now = OffsetDateTime.now();
        RefreshToken stored = refreshTokenRepository
                .findByTokenHashForUpdate(refreshTokenHasher.hash(rawRefreshToken))
                .filter(token -> token.usableAt(now))
                .orElseThrow(() -> BusinessException.of(ErrorCode.INVALID_TOKEN));
        stored.revoke(now);
        User user = activeUser(stored.getUserSeq());
        return issue(user, stored.getDeviceSeq());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenRepository
                .findByTokenHashForUpdate(refreshTokenHasher.hash(rawRefreshToken))
                .filter(token -> token.getRevokedDttm() == null)
                .ifPresent(token -> {
                    token.revoke(OffsetDateTime.now());
                    if (token.getDeviceSeq() != null) {
                        // 변경: 로그아웃 세션에 연결된 FCM 토큰도 같은 트랜잭션에서 비활성화한다.
                        deviceService.deactivateForLogout(
                                token.getUserSeq(),
                                token.getDeviceSeq()
                        );
                    }
                });
    }

    @Transactional
    public AuthDtos.TokenResponse issueForLocalUser(User user) {
        assertUsable(user);
        return issue(user, null);
    }

    public boolean nicknameAvailable(String nickname) {
        if (nickname == null || !nickname.matches("^[가-힣A-Za-z0-9]{2,20}$")) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        return !userRepository.existsByNicknameAndDeletedFalse(nickname);
    }

    private AuthDtos.TokenResponse issue(User user, Long deviceSeq) {
        TokenValue access = jwtService.createAccessToken(user.getUserSeq(), user.getRole().name());
        byte[] refreshBytes = new byte[32];
        secureRandom.nextBytes(refreshBytes);
        String rawRefresh = Base64.getUrlEncoder().withoutPadding().encodeToString(refreshBytes);
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime refreshExpiresAt = now.plus(jwtProperties.refreshTokenTtl());
        refreshTokenRepository.save(RefreshToken.builder()
                .userSeq(user.getUserSeq())
                .deviceSeq(deviceSeq)
                .tokenHash(refreshTokenHasher.hash(rawRefresh))
                .expiresDttm(refreshExpiresAt)
                .regDttm(now)
                .build());
        return new AuthDtos.TokenResponse(
                access.value(),
                access.expiresAt(),
                rawRefresh,
                refreshExpiresAt.toInstant(),
                "Bearer"
        );
    }

    private Jwt decodeSignupToken(String token) {
        try {
            Jwt jwt = signupTokenDecoder.decode(token);
            if (!"SIGNUP".equals(jwt.getClaimAsString("token_type"))) {
                throw BusinessException.of(ErrorCode.INVALID_TOKEN);
            }
            return jwt;
        } catch (JwtException exception) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
    }

    private OAuthProvider provider(String providerCode) {
        return providerRepository.findByProviderCodeAndActiveTrue(providerCode)
                .orElseThrow(() -> BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER));
    }

    private User activeUser(Integer userSeq) {
        User user = userRepository.findByUserSeqAndDeletedFalse(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.USER_NOT_FOUND));
        assertUsable(user);
        return user;
    }

    private void assertUsable(User user) {
        switch (user.getAccountStatus()) {
            case ACTIVE -> {
            }
            case SUSPENDED -> throw BusinessException.of(ErrorCode.ACCOUNT_SUSPENDED);
            case BANNED -> throw BusinessException.of(ErrorCode.ACCOUNT_BANNED);
            case WITHDRAWN -> throw BusinessException.of(ErrorCode.ACCOUNT_WITHDRAWN);
        }
    }

}
