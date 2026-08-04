package com.starttoo.backend.auth.application;

import com.starttoo.backend.auth.api.AuthDtos;
import com.starttoo.backend.auth.domain.OAuthProvider;
import com.starttoo.backend.auth.domain.OAuthProviderRepository;
import com.starttoo.backend.auth.domain.RefreshToken;
import com.starttoo.backend.auth.domain.RefreshTokenRepository;
import com.starttoo.backend.auth.domain.UserOAuthAccount;
import com.starttoo.backend.auth.domain.UserOAuthAccountRepository;
import com.starttoo.backend.artist.domain.Artist;
import com.starttoo.backend.artist.domain.ArtistRepository;
import com.starttoo.backend.artist.domain.VerificationStatus;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final List<String> NICKNAME_BASES = List.of(
            "검은장미",
            "푸른나비",
            "별빛라인",
            "달빛잉크",
            "새벽도안",
            "잉크구름",
            "작은파도",
            "하얀고래",
            "붉은노을",
            "초록바늘",
            "은빛달",
            "먹빛꽃",
            "고요한점",
            "선명한결",
            "여름선",
            "겨울잉크",
            "봄날스케치",
            "가을타투",
            "미니라인",
            "도트무드",
            "BlackRose",
            "LineArt",
            "InkMood",
            "TinyInk",
            "BlueNeedle",
            "MoonLine",
            "DotCanvas",
            "FineShade",
            "WaveTattoo",
            "SoftStencil"
    );
    private static final int NICKNAME_MAX_ATTEMPTS = 100;

    private final OAuthProviderRepository providerRepository;
    private final UserOAuthAccountRepository oauthAccountRepository;
    private final UserRepository userRepository;
    private final ArtistRepository artistRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SignupTokenConsumer signupTokenConsumer;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final JdbcTemplate jdbcTemplate;
    private final RefreshTokenHasher refreshTokenHasher;
    private final PhoneNumberNormalizer phoneNumberNormalizer;
    private final SearchIndexEventPublisher searchIndexEventPublisher;
    private final DeviceService deviceService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public AuthDtos.SocialLoginResponse socialLogin(
            OAuthSubjectResolver.OAuthSubject subject
    ) {
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
        UserRole role = role(request.role());
        Jwt signupJwt = signupTokenConsumer.validate(request.signupToken());
        String providerCode = signupJwt.getClaimAsString("provider");
        String providerSubject = signupJwt.getSubject();
        OAuthProvider provider = provider(providerCode);
        String phoneNumber = phoneNumberNormalizer.normalizeKorean(request.phoneNumber());

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
            var existingUser =
                    userRepository.findByPhoneNumberAndAccountStatusNotAndDeletedFalse(
                            phoneNumber,
                            AccountStatus.WITHDRAWN
                    );
            if (existingUser.isPresent()) {
                throw BusinessException.of(ErrorCode.DUPLICATE_PHONE_NUMBER);
            }
            if (userRepository.existsByNicknameAndAccountStatusNotAndDeletedFalse(
                    request.nickname(),
                    AccountStatus.WITHDRAWN
            )) {
                throw BusinessException.of(ErrorCode.DUPLICATE_NICKNAME);
            }
            User user = userRepository.saveAndFlush(User.builder()
                    .nickname(request.nickname())
                    .phoneNumber(phoneNumber)
                    .phoneVerifiedDttm(now)
                    .birthDate(request.birthDate())
                    .gender(request.gender())
                    .role(role)
                    .recentSearchTerms(new String[0])
                    .accountStatus(AccountStatus.ACTIVE)
                    .statusChangedDttm(now)
                    .regDttm(now)
                    .modDttm(now)
                    .deleted(false)
                    .build());
            user.initializeModifier();
            userRepository.flush();

            if (role == UserRole.ARTIST) {
                artistRepository.save(Artist.builder()
                        .userSeq(user.getUserSeq())
                        .verificationStatus(VerificationStatus.UNVERIFIED)
                        .regDttm(now)
                        .modDttm(now)
                        .modUsrSeq(user.getUserSeq())
                        .deleted(false)
                        .build());
            }

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
            AuthDtos.TokenResponse response = issue(user, null);
            signupTokenConsumer.consumeAfterCommit(signupJwt);
            return response;
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

    public boolean nicknameAvailable(String nickname) {
        if (nickname == null || !nickname.matches("^[가-힣A-Za-z0-9]{2,20}$")) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        return !userRepository.existsByNicknameAndAccountStatusNotAndDeletedFalse(
                nickname,
                AccountStatus.WITHDRAWN
        );
    }

    public String nicknameSuggestion() {
        int seed = secureRandom.nextInt(10_000);
        for (int attempt = 0; attempt < NICKNAME_MAX_ATTEMPTS; attempt++) {
            String base = NICKNAME_BASES.get(attempt % NICKNAME_BASES.size());
            int suffix = Math.floorMod(seed + attempt * 37, 10_000);
            String candidate = base + suffix;
            if (!userRepository.existsByNicknameAndAccountStatusNotAndDeletedFalse(
                    candidate,
                    AccountStatus.WITHDRAWN
            )) {
                return candidate;
            }
        }
        throw BusinessException.of(ErrorCode.STATE_CONFLICT);
    }

    public AuthDtos.PhoneAvailabilityResponse phoneAvailability(String phoneNumber) {
        String normalized = phoneNumberNormalizer.normalizeKorean(phoneNumber);
        return userRepository.findByPhoneNumberAndAccountStatusNotAndDeletedFalse(
                        normalized,
                        AccountStatus.WITHDRAWN
                )
                .map(user -> new AuthDtos.PhoneAvailabilityResponse(
                        normalized,
                        false,
                        providerCode(user.getUserSeq())
                ))
                .orElseGet(() -> new AuthDtos.PhoneAvailabilityResponse(
                        normalized,
                        true,
                        null
                ));
    }

    private String providerCode(Integer userSeq) {
        UserOAuthAccount account = oauthAccountRepository
                .findFirstByUserSeqAndDeletedFalseOrderByUserOauthAccountSeqAsc(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.STATE_CONFLICT));
        return providerRepository.findById(account.getOauthProviderSeq())
                .map(OAuthProvider::getProviderCode)
                .orElseThrow(() -> BusinessException.of(ErrorCode.STATE_CONFLICT));
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

    private OAuthProvider provider(String providerCode) {
        return providerRepository.findByProviderCodeAndActiveTrue(providerCode)
                .orElseThrow(() -> BusinessException.of(ErrorCode.INVALID_OAUTH_PROVIDER));
    }

    private UserRole role(String role) {
        if (!UserRole.USER.name().equals(role) && !UserRole.ARTIST.name().equals(role)) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        return UserRole.valueOf(role);
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
