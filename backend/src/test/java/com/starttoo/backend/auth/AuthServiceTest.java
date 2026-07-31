package com.starttoo.backend.auth;

import com.starttoo.backend.artist.domain.Artist;
import com.starttoo.backend.artist.domain.ArtistRepository;
import com.starttoo.backend.artist.domain.VerificationStatus;
import com.starttoo.backend.auth.api.AuthDtos;
import com.starttoo.backend.auth.application.AuthService;
import com.starttoo.backend.auth.application.OAuthSubjectResolver;
import com.starttoo.backend.auth.application.PhoneNumberNormalizer;
import com.starttoo.backend.auth.application.RefreshTokenHasher;
import com.starttoo.backend.auth.application.SignupTokenConsumer;
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
import com.starttoo.backend.notification.application.DeviceService;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private OAuthProviderRepository providerRepository;
    @Mock
    private UserOAuthAccountRepository oauthAccountRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ArtistRepository artistRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private SignupTokenConsumer signupTokenConsumer;
    @Mock
    private JwtService jwtService;
    @Mock
    private JwtProperties jwtProperties;
    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private RefreshTokenHasher refreshTokenHasher;
    @Mock
    private PhoneNumberNormalizer phoneNumberNormalizer;
    @Mock
    private SearchIndexEventPublisher searchIndexEventPublisher;
    @Mock
    private DeviceService deviceService;

    @InjectMocks
    private AuthService authService;

    @Test
    void phoneAvailabilityReturnsAvailableWhenNormalizedNumberIsNotRegistered() {
        when(phoneNumberNormalizer.normalizeKorean("010-1234-5678"))
                .thenReturn("+821012345678");
        when(userRepository.findByPhoneNumberAndAccountStatusNotAndDeletedFalse(
                "+821012345678",
                AccountStatus.WITHDRAWN
        )).thenReturn(Optional.empty());

        AuthDtos.PhoneAvailabilityResponse response =
                authService.phoneAvailability("010-1234-5678");

        assertThat(response.normalizedPhoneNumber()).isEqualTo("+821012345678");
        assertThat(response.available()).isTrue();
        assertThat(response.provider()).isNull();
    }

    @Test
    void phoneAvailabilityReturnsProviderWhenNumberIsRegistered() {
        User existing = user(7, "기존닉네임", UserRole.USER);
        UserOAuthAccount account = UserOAuthAccount.builder()
                .userOauthAccountSeq(10L)
                .userSeq(7)
                .oauthProviderSeq(1)
                .providerSubject("subject-1")
                .regDttm(OffsetDateTime.now())
                .modDttm(OffsetDateTime.now())
                .deleted(false)
                .build();
        when(phoneNumberNormalizer.normalizeKorean("010-1234-5678"))
                .thenReturn("+821012345678");
        when(userRepository.findByPhoneNumberAndAccountStatusNotAndDeletedFalse(
                "+821012345678",
                AccountStatus.WITHDRAWN
        )).thenReturn(Optional.of(existing));
        when(oauthAccountRepository
                .findFirstByUserSeqAndDeletedFalseOrderByUserOauthAccountSeqAsc(7))
                .thenReturn(Optional.of(account));
        when(providerRepository.findById(1)).thenReturn(Optional.of(provider()));

        AuthDtos.PhoneAvailabilityResponse response =
                authService.phoneAvailability("010-1234-5678");

        assertThat(response.normalizedPhoneNumber()).isEqualTo("+821012345678");
        assertThat(response.available()).isFalse();
        assertThat(response.provider()).isEqualTo("KAKAO");
    }

    @Test
    void unlinkedOAuthReturnsOnlySignupToken() {
        OAuthProvider provider = provider();
        when(providerRepository.findByProviderCodeAndActiveTrue("KAKAO"))
                .thenReturn(Optional.of(provider));
        when(oauthAccountRepository
                .findByOauthProviderSeqAndProviderSubjectAndDeletedFalse(1, "subject-1"))
                .thenReturn(Optional.empty());
        when(jwtProperties.signupTokenTtl()).thenReturn(Duration.ofMinutes(10));
        when(jwtService.createTypedToken(
                eq("subject-1"),
                eq("SIGNUP"),
                eq(Duration.ofMinutes(10)),
                any()
        )).thenReturn(new TokenValue("signup-token", Instant.now().plusSeconds(600)));

        AuthDtos.SocialLoginResponse response = authService.socialLogin(
                new OAuthSubjectResolver.OAuthSubject("KAKAO", "subject-1")
        );

        assertThat(response.signupRequired()).isTrue();
        assertThat(response.signupToken()).isEqualTo("signup-token");
        assertThat(response.tokens()).isNull();
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void artistSignupCreatesUserRoleAndUnverifiedArtist() {
        stubNewSignup();

        AuthDtos.TokenResponse response = authService.signup(
                signupRequest("ARTIST", "검은장미1")
        );

        assertThat(response.accessToken()).isEqualTo("access-token");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(userCaptor.capture());
        assertThat(userCaptor.getValue().getRole()).isEqualTo(UserRole.USER);

        ArgumentCaptor<Artist> artistCaptor = ArgumentCaptor.forClass(Artist.class);
        verify(artistRepository).save(artistCaptor.capture());
        assertThat(artistCaptor.getValue().getUserSeq()).isEqualTo(7);
        assertThat(artistCaptor.getValue().getVerificationStatus())
                .isEqualTo(VerificationStatus.UNVERIFIED);
        verify(searchIndexEventPublisher).accountChanged(7);
        verify(signupTokenConsumer).consumeAfterCommit(any(Jwt.class));
    }

    @Test
    void signupRejectsPhoneNumberAlreadyOwnedByAnotherAccount() {
        Jwt jwt = signupJwt();
        User existing = user(7, "기존닉네임", UserRole.USER);
        when(signupTokenConsumer.validate("signup-token")).thenReturn(jwt);
        when(providerRepository.findByProviderCodeAndActiveTrue("KAKAO"))
                .thenReturn(Optional.of(provider()));
        when(phoneNumberNormalizer.normalizeKorean("010-1234-5678"))
                .thenReturn("+821012345678");
        when(oauthAccountRepository
                .findByOauthProviderSeqAndProviderSubjectAndDeletedFalse(1, "subject-1"))
                .thenReturn(Optional.empty());
        when(userRepository.findByPhoneNumberAndAccountStatusNotAndDeletedFalse(
                "+821012345678",
                AccountStatus.WITHDRAWN
        ))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> authService.signup(
                signupRequest("ARTIST", "새닉네임")
        ))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.DUPLICATE_PHONE_NUMBER));

        verify(userRepository, never()).saveAndFlush(any(User.class));
        verify(artistRepository, never()).save(any(Artist.class));
        verify(oauthAccountRepository, never()).save(any());
        verify(signupTokenConsumer, never()).consumeAfterCommit(any());
    }

    @Test
    void serviceRejectsAdminSignupBeforeConsumingTokens() {
        assertThatThrownBy(() -> authService.signup(
                signupRequest("ADMIN", "검은장미1")
        ))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.INVALID_REQUEST));

        verifyNoInteractions(signupTokenConsumer, phoneNumberNormalizer);
    }

    @Test
    void refreshTokenCannotBeReusedAfterRotation() {
        OffsetDateTime now = OffsetDateTime.now();
        RefreshToken stored = RefreshToken.builder()
                .userSeq(7)
                .deviceSeq(91L)
                .tokenHash(new byte[32])
                .expiresDttm(now.plusDays(1))
                .regDttm(now)
                .build();
        User user = user(7, "검은장미", UserRole.USER);
        when(refreshTokenRepository.findByTokenHashForUpdate(any(byte[].class)))
                .thenReturn(Optional.of(stored));
        when(userRepository.findByUserSeqAndDeletedFalse(7)).thenReturn(Optional.of(user));
        stubTokenIssue(user);

        authService.refresh("old-refresh");

        assertThat(stored.getRevokedDttm()).isNotNull();
        assertThatThrownBy(() -> authService.refresh("old-refresh"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_TOKEN));
    }

    @Test
    void logoutIsIdempotentAndDeactivatesDeviceOnce() {
        OffsetDateTime now = OffsetDateTime.now();
        RefreshToken stored = RefreshToken.builder()
                .userSeq(7)
                .deviceSeq(91L)
                .tokenHash(new byte[32])
                .expiresDttm(now.plusDays(1))
                .regDttm(now)
                .build();
        when(refreshTokenHasher.hash("refresh")).thenReturn(new byte[32]);
        when(refreshTokenRepository.findByTokenHashForUpdate(any(byte[].class)))
                .thenReturn(Optional.of(stored));

        authService.logout("refresh");
        authService.logout("refresh");

        verify(deviceService).deactivateForLogout(7, 91L);
    }

    @Test
    void nicknameSuggestionsAreFiniteUniqueAndValid() {
        when(userRepository.existsByNicknameAndAccountStatusNotAndDeletedFalse(
                anyString(),
                eq(AccountStatus.WITHDRAWN)
        )).thenReturn(false);

        List<String> suggestions = authService.nicknameSuggestions(10);

        assertThat(suggestions)
                .hasSize(10)
                .doesNotHaveDuplicates()
                .allMatch(value -> value.matches("^[가-힣A-Za-z0-9]{2,20}$"));
    }

    private void stubNewSignup() {
        Jwt jwt = signupJwt();
        User persisted = user(7, "검은장미1", UserRole.USER);
        when(signupTokenConsumer.validate("signup-token")).thenReturn(jwt);
        when(providerRepository.findByProviderCodeAndActiveTrue("KAKAO"))
                .thenReturn(Optional.of(provider()));
        when(phoneNumberNormalizer.normalizeKorean("010-1234-5678"))
                .thenReturn("+821012345678");
        when(oauthAccountRepository
                .findByOauthProviderSeqAndProviderSubjectAndDeletedFalse(1, "subject-1"))
                .thenReturn(Optional.empty());
        when(userRepository.findByPhoneNumberAndAccountStatusNotAndDeletedFalse(
                "+821012345678",
                AccountStatus.WITHDRAWN
        ))
                .thenReturn(Optional.empty());
        when(userRepository.existsByNicknameAndAccountStatusNotAndDeletedFalse(
                "검은장미1",
                AccountStatus.WITHDRAWN
        ))
                .thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenReturn(persisted);
        stubTokenIssue(persisted);
    }

    private void stubTokenIssue(User user) {
        when(jwtService.createAccessToken(user.getUserSeq(), user.getRole().name()))
                .thenReturn(new TokenValue(
                        "access-token",
                        Instant.now().plusSeconds(3600)
                ));
        when(jwtProperties.refreshTokenTtl()).thenReturn(Duration.ofDays(30));
        when(refreshTokenHasher.hash(anyString())).thenReturn(new byte[32]);
    }

    private AuthDtos.SignupRequest signupRequest(String role, String nickname) {
        return new AuthDtos.SignupRequest(
                "signup-token",
                "010-1234-5678",
                nickname,
                role,
                null,
                null
        );
    }

    private Jwt signupJwt() {
        Jwt jwt = org.mockito.Mockito.mock(Jwt.class);
        when(jwt.getClaimAsString("provider")).thenReturn("KAKAO");
        when(jwt.getSubject()).thenReturn("subject-1");
        return jwt;
    }

    private OAuthProvider provider() {
        OffsetDateTime now = OffsetDateTime.now();
        return new OAuthProvider(1, "KAKAO", "카카오", true, now, 1, now, 1);
    }

    private User user(Integer userSeq, String nickname, UserRole role) {
        OffsetDateTime now = OffsetDateTime.now();
        return User.builder()
                .userSeq(userSeq)
                .nickname(nickname)
                .phoneNumber("+821012345678")
                .phoneVerifiedDttm(now)
                .role(role)
                .recentSearchTerms(new String[0])
                .accountStatus(AccountStatus.ACTIVE)
                .statusChangedDttm(now)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
    }
}
