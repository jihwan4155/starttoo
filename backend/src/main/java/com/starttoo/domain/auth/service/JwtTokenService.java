package com.starttoo.domain.auth.service;

import com.starttoo.domain.auth.dto.AccessTokenResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class JwtTokenService {

    private final JwtEncoder jwtEncoder;
    private final String issuer;
    private final long accessTokenSeconds;
    private final long signupTokenSeconds;
    private final Clock clock;
    private final NimbusJwtDecoder signupTokenDecoder;

    public JwtTokenService(
            JwtEncoder jwtEncoder,
            @Value("${app.security.jwt.issuer}") String issuer,
            @Value("${app.security.jwt.access-token-seconds}") long accessTokenSeconds,
            @Value("${app.security.jwt.signup-token-seconds}") long signupTokenSeconds,
            @Value("${app.security.jwt.secret}") String secret
    ) {
        this.jwtEncoder = jwtEncoder;
        this.issuer = issuer;
        this.accessTokenSeconds = accessTokenSeconds;
        this.signupTokenSeconds = signupTokenSeconds;
        this.clock = Clock.systemUTC();
        SecretKey secretKey = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
        );
        this.signupTokenDecoder = NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    public AccessTokenResponse issueAccessToken(Long userId, String role) {
        Instant issuedAt = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plusSeconds(accessTokenSeconds);

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(String.valueOf(userId))
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .claim("token_use", "access")
                .claim("role", role)
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256)
                .type("JWT")
                .build();

        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims))
                .getTokenValue();

        return new AccessTokenResponse(token, "Bearer", expiresAt);
    }

    public SignupToken issueSignupToken(
            String provider,
            String subject,
            String email,
            String platform,
            String pushToken
    ) {
        Instant issuedAt = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plusSeconds(signupTokenSeconds);
        JwtClaimsSet.Builder claimsBuilder = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(subject)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .claim("token_use", "signup")
                .claim("provider", provider)
                .claim("platform", platform);
        if (email != null) {
            claimsBuilder.claim("email", email);
        }
        if (pushToken != null && !pushToken.isBlank()) {
            claimsBuilder.claim("push_token", pushToken);
        }

        String token = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).type("JWT").build(),
                claimsBuilder.build()
        )).getTokenValue();
        return new SignupToken(token, expiresAt);
    }

    public SignupClaims decodeSignupToken(String token) {
        try {
            var jwt = signupTokenDecoder.decode(token);
            if (!issuer.equals(jwt.getClaimAsString(JwtClaimNames.ISS))
                    || !"signup".equals(jwt.getClaimAsString("token_use"))
                    || jwt.getExpiresAt() == null
                    || !jwt.getExpiresAt().isAfter(clock.instant())) {
                throw new BusinessException(ErrorCode.SIGNUP_TOKEN_INVALID);
            }
            return new SignupClaims(
                    jwt.getClaimAsString("provider"),
                    jwt.getSubject(),
                    jwt.getClaimAsString("email"),
                    jwt.getClaimAsString("platform"),
                    jwt.getClaimAsString("push_token")
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (JwtException exception) {
            throw new BusinessException(ErrorCode.SIGNUP_TOKEN_INVALID);
        }
    }

    public long accessTokenSeconds() {
        return accessTokenSeconds;
    }

    public long signupTokenSeconds() {
        return signupTokenSeconds;
    }

    public record SignupToken(String token, Instant expiresAt) {
    }

    public record SignupClaims(
            String provider,
            String subject,
            String email,
            String platform,
            String pushToken
    ) {
    }
}
