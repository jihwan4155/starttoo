package com.starttoo.backend.common.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.starttoo.backend.common.config.JwtProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Configuration
public class JwtConfig {

    @Bean
    SecretKey jwtSecretKey(JwtProperties properties) {
        byte[] bytes = properties.secret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT secret must contain at least 32 bytes");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey key) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    @Bean
    @Primary
    JwtDecoder jwtDecoder(SecretKey key, JwtProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        OAuth2TokenValidator<Jwt> issuer = JwtValidators.createDefaultWithIssuer(properties.issuer());
        OAuth2TokenValidator<Jwt> tokenType =
                new JwtClaimValidator<>("token_type", "ACCESS"::equals);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuer, tokenType));
        return decoder;
    }

    @Bean("rawJwtDecoder")
    JwtDecoder rawJwtDecoder(SecretKey key, JwtProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.issuer()));
        return decoder;
    }

    @Service
    public static class JwtService {

        /**
         * 서명 알고리즘을 명시한다. 생략하면 NimbusJwtEncoder가 RS256을 기본값으로 잡고
         * HMAC 비밀키 소스에서 RSA 키를 찾다 실패해 "Failed to select a JWK signing key"가 난다.
         */
        private static final JwsHeader HS256_HEADER =
                JwsHeader.with(MacAlgorithm.HS256).build();

        private final JwtEncoder encoder;
        private final JwtProperties properties;

        public JwtService(JwtEncoder encoder, JwtProperties properties) {
            this.encoder = encoder;
            this.properties = properties;
        }

        public TokenValue createAccessToken(Integer userSeq, String role) {
            Instant now = Instant.now();
            Instant expiresAt = now.plus(properties.accessTokenTtl());
            JwtClaimsSet claims = JwtClaimsSet.builder()
                    .issuer(properties.issuer())
                    .issuedAt(now)
                    .expiresAt(expiresAt)
                    .subject(userSeq.toString())
                    .claim("role", role)
                    .claim("token_type", "ACCESS")
                    .build();
            String token = encoder
                    .encode(JwtEncoderParameters.from(HS256_HEADER, claims))
                    .getTokenValue();
            return new TokenValue(token, expiresAt);
        }

        public TokenValue createTypedToken(
                String subject,
                String tokenType,
                java.time.Duration ttl,
                Map<String, Object> additionalClaims
        ) {
            Instant now = Instant.now();
            Instant expiresAt = now.plus(ttl);
            JwtClaimsSet.Builder builder = JwtClaimsSet.builder()
                    .issuer(properties.issuer())
                    .issuedAt(now)
                    .expiresAt(expiresAt)
                    .subject(subject)
                    .id(UUID.randomUUID().toString())
                    .claim("token_type", tokenType);
            additionalClaims.forEach(builder::claim);
            String token = encoder
                    .encode(JwtEncoderParameters.from(HS256_HEADER, builder.build()))
                    .getTokenValue();
            return new TokenValue(token, expiresAt);
        }
    }

    public record TokenValue(String value, Instant expiresAt) {
    }
}
