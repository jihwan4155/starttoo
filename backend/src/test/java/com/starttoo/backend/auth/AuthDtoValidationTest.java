package com.starttoo.backend.auth;

import com.starttoo.backend.auth.api.AuthDtos;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuthDtoValidationTest {

    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void signupRoleAllowsOnlyUserAndArtist() {
        AuthDtos.SignupRequest user = request("USER");
        AuthDtos.SignupRequest artist = request("ARTIST");
        AuthDtos.SignupRequest admin = request("ADMIN");

        assertThat(validator.validate(user)).isEmpty();
        assertThat(validator.validate(artist)).isEmpty();
        assertThat(validator.validate(admin))
                .anyMatch(violation -> "role".equals(
                        violation.getPropertyPath().toString()
                ));
    }

    @Test
    void socialLoginAcceptsEitherAccessTokenOrAuthorizationCode() {
        AuthDtos.SocialLoginRequest nativeApp =
                new AuthDtos.SocialLoginRequest("KAKAO", "provider-token", null, null);
        AuthDtos.SocialLoginRequest web = new AuthDtos.SocialLoginRequest(
                "KAKAO", null, "auth-code", "https://localhost:5173/auth/kakao/callback");

        assertThat(validator.validate(nativeApp)).isEmpty();
        assertThat(validator.validate(web)).isEmpty();
    }

    @Test
    void socialLoginRejectsBothOrNeitherCredential() {
        AuthDtos.SocialLoginRequest both = new AuthDtos.SocialLoginRequest(
                "KAKAO", "provider-token", "auth-code", "https://localhost:5173/cb");
        AuthDtos.SocialLoginRequest neither =
                new AuthDtos.SocialLoginRequest("KAKAO", null, null, null);

        assertThat(validator.validate(both))
                .anyMatch(violation -> "exactlyOneCredentialPresent".equals(
                        violation.getPropertyPath().toString()
                ));
        assertThat(validator.validate(neither))
                .anyMatch(violation -> "exactlyOneCredentialPresent".equals(
                        violation.getPropertyPath().toString()
                ));
    }

    @Test
    void socialLoginRequiresRedirectUriWithAuthorizationCode() {
        AuthDtos.SocialLoginRequest missingRedirect =
                new AuthDtos.SocialLoginRequest("KAKAO", null, "auth-code", null);

        assertThat(validator.validate(missingRedirect))
                .anyMatch(violation -> "redirectUriPresentWithCode".equals(
                        violation.getPropertyPath().toString()
                ));
    }

    private AuthDtos.SignupRequest request(String role) {
        return new AuthDtos.SignupRequest(
                "signup-token",
                "010-1234-5678",
                "검은장미1",
                role,
                null,
                null
        );
    }
}
