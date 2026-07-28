package com.starttoo.domain.auth.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.config.properties.ProfileImageProperties;
import com.starttoo.domain.artist.entity.TattooArtistEntity;
import com.starttoo.domain.artist.repository.TattooArtistRepository;
import com.starttoo.domain.auth.dto.AuthDtos.ArtistProfileRequest;
import com.starttoo.domain.auth.dto.AuthDtos.ArtistSummary;
import com.starttoo.domain.auth.dto.AuthDtos.RefreshResponse;
import com.starttoo.domain.auth.dto.AuthDtos.SignupRequest;
import com.starttoo.domain.auth.dto.AuthDtos.SignupProfileUploadRequest;
import com.starttoo.domain.auth.dto.AuthDtos.SocialLoginRequest;
import com.starttoo.domain.auth.dto.AuthDtos.SocialLoginResponse;
import com.starttoo.domain.auth.dto.AuthDtos.SocialProfileResponse;
import com.starttoo.domain.auth.dto.AuthDtos.TokenResponse;
import com.starttoo.domain.auth.dto.AuthDtos.UserSummary;
import com.starttoo.domain.auth.oauth.SocialOAuthClientRegistry;
import com.starttoo.domain.image.service.ObjectStoragePort;
import com.starttoo.domain.image.service.ObjectStoragePort.PresignedUpload;
import com.starttoo.domain.user.entity.UserDeviceEntity;
import com.starttoo.domain.user.entity.UserEntity;
import com.starttoo.domain.user.repository.UserDeviceRepository;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserDeviceRepository userDeviceRepository;
    private final TattooArtistRepository tattooArtistRepository;
    private final SocialOAuthClientRegistry oauthClientRegistry;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;
    private final ObjectStoragePort objectStoragePort;
    private final ProfileImageProperties profileImageProperties;
    private final Clock clock = Clock.systemUTC();

    @Value("${app.oauth.allowed-redirect-uris}")
    private String allowedRedirectUrisProperty;

    @Transactional
    public SocialLoginResult login(SocialLoginRequest request) {
        validateRedirectUri(request.redirectUri());
        var profile = oauthClientRegistry.require(request.provider())
                .exchange(request.authorizationCode(), request.redirectUri());
        var existing = userRepository.findByOauthProviderAndOauthSubject(
                profile.provider(), profile.subject()
        );

        if (existing.isEmpty()) {
            var signup = jwtTokenService.issueSignupToken(
                    profile.provider(), profile.subject(), profile.email(),
                    request.platform(), request.pushToken()
            );
            return new SocialLoginResult(new SocialLoginResponse(
                    true, null, null, null, jwtTokenService.signupTokenSeconds(),
                    null, signup.token(), new SocialProfileResponse(profile.provider(), profile.email())
            ), null, request.platform());
        }

        UserEntity user = existing.get();
        validateAccount(user);
        Long deviceId = registerDevice(user.getUserId(), request.pushToken(), request.platform());
        var access = jwtTokenService.issueAccessToken(user.getUserId(), user.getRole());
        var refresh = refreshTokenService.issue(user.getUserId(), deviceId);
        String responseRefreshToken = "WEB".equals(request.platform()) ? null : refresh.token();
        var response = new SocialLoginResponse(
                false,
                access.accessToken(),
                responseRefreshToken,
                access.tokenType(),
                jwtTokenService.accessTokenSeconds(),
                summary(user),
                null,
                null
        );
        return new SocialLoginResult(response, refresh.token(), request.platform());
    }

    @Transactional
    public SignupResult signup(SignupRequest request) {
        var claims = jwtTokenService.decodeSignupToken(request.signupToken());
        if (userRepository.findByOauthProviderAndOauthSubject(
                claims.provider(), claims.subject()
        ).isPresent()) {
            throw new BusinessException(ErrorCode.SOCIAL_ACCOUNT_ALREADY_REGISTERED);
        }

        String nickname = request.nickname().trim();
        if (nickname.length() < 2 || nickname.length() > 50) {
            throw new BusinessException(ErrorCode.NICKNAME_FORMAT_INVALID);
        }
        if (userRepository.existsByNickname(nickname)) {
            throw new BusinessException(ErrorCode.NICKNAME_DUPLICATED);
        }

        String profileImageKey = profileImageProperties.getDefaultImageKey();
        if (request.profileImageKey() != null && !request.profileImageKey().isBlank()) {
            profileImageKey = request.profileImageKey().trim();
            objectStoragePort.verifySignupUploadedObject(
                    profileImageKey,
                    claims.provider(),
                    claims.subject()
            );
        }

        UserEntity user = userRepository.save(UserEntity.builder()
                .oauthProvider(claims.provider())
                .oauthSubject(claims.subject())
                .email(claims.email())
                .nickname(nickname)
                .profileImageKey(profileImageKey)
                .birthDate(request.birthDate())
                .gender(request.gender())
                .role(request.role())
                .accountStatus("ACTIVE")
                .build());

        if ("ARTIST".equals(request.role())) {
            ArtistProfileRequest artist = request.artistProfile();
            tattooArtistRepository.save(TattooArtistEntity.builder()
                    .userId(user.getUserId())
                    .shopName(artist == null ? null : trim(artist.shopName()))
                    .shopCity(artist == null ? null : trim(artist.shopCity()))
                    .shopAddress(artist == null ? null : trim(artist.shopAddress()))
                    .shopPhone(artist == null ? null : trim(artist.shopPhone()))
                    .businessHours(artist == null ? null : trim(artist.businessHours()))
                    .approvalStatus("UNVERIFIED")
                    .build());
        }

        Long deviceId = registerDevice(user.getUserId(), claims.pushToken(), claims.platform());
        var access = jwtTokenService.issueAccessToken(user.getUserId(), user.getRole());
        var refresh = refreshTokenService.issue(user.getUserId(), deviceId);
        String bodyRefresh = "WEB".equals(claims.platform()) ? null : refresh.token();

        return new SignupResult(new TokenResponse(
                access.accessToken(), bodyRefresh, "Bearer",
                jwtTokenService.accessTokenSeconds(), summary(user)
        ), refresh.token(), claims.platform());
    }

    public PresignedUpload createSignupProfileUpload(SignupProfileUploadRequest request) {
        var claims = jwtTokenService.decodeSignupToken(request.signupToken());
        return objectStoragePort.createSignupUpload(
                request.contentType(),
                request.fileSize(),
                claims.provider(),
                claims.subject()
        );
    }

    @Transactional
    public RefreshResult refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_REQUIRED);
        }
        var rotated = refreshTokenService.rotate(refreshToken);
        UserEntity user = userRepository.findById(rotated.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        validateAccount(user);
        var access = jwtTokenService.issueAccessToken(user.getUserId(), user.getRole());
        return new RefreshResult(new RefreshResponse(
                access.accessToken(), rotated.token(), "Bearer",
                jwtTokenService.accessTokenSeconds()
        ), rotated.token());
    }

    @Transactional
    public void logout(Long userId, String refreshToken) {
        refreshTokenService.revoke(refreshToken, userId);
    }

    private Long registerDevice(Long userId, String pushToken, String platform) {
        if (pushToken == null || pushToken.isBlank()) {
            return null;
        }
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        UserDeviceEntity device = userDeviceRepository.findByPushToken(pushToken)
                .map(existing -> {
                    existing.activate(userId, platform, now);
                    return existing;
                })
                .orElseGet(() -> UserDeviceEntity.builder()
                        .userId(userId)
                        .pushToken(pushToken)
                        .platform(platform)
                        .active(true)
                        .lastUsedAt(now)
                        .build());
        return userDeviceRepository.save(device).getDeviceId();
    }

    private UserSummary summary(UserEntity user) {
        ArtistSummary artist = tattooArtistRepository.findById(user.getUserId())
                .map(value -> new ArtistSummary(value.getApprovalStatus()))
                .orElse(null);
        String imageUrl = user.getProfileImageKey() == null
                ? null : objectStoragePort.createDownloadUrl(user.getProfileImageKey());
        return new UserSummary(
                user.getUserId(), user.getNickname(), user.getRole(),
                user.getAccountStatus(), imageUrl, artist
        );
    }

    private void validateAccount(UserEntity user) {
        if ("SUSPENDED".equals(user.getAccountStatus())) {
            throw new BusinessException(ErrorCode.ACCOUNT_SUSPENDED);
        }
        if ("WITHDRAWN".equals(user.getAccountStatus())) {
            throw new BusinessException(ErrorCode.ACCOUNT_WITHDRAWN);
        }
    }

    private void validateRedirectUri(String redirectUri) {
        Set<String> allowed = Arrays.stream(allowedRedirectUrisProperty.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
        if (!allowed.contains(redirectUri)) {
            throw new BusinessException(ErrorCode.OAUTH_REDIRECT_URI_MISMATCH);
        }
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    public record SocialLoginResult(
            SocialLoginResponse response,
            String refreshToken,
            String platform
    ) {
    }

    public record SignupResult(TokenResponse response, String refreshToken, String platform) {
    }

    public record RefreshResult(RefreshResponse response, String refreshToken) {
    }
}
