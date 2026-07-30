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
                .anyMatch(violation -> "requestedRole".equals(
                        violation.getPropertyPath().toString()
                ));
    }

    private AuthDtos.SignupRequest request(String role) {
        return new AuthDtos.SignupRequest(
                "signup-token",
                "phone-token",
                "검은장미1",
                role,
                null,
                null
        );
    }
}
