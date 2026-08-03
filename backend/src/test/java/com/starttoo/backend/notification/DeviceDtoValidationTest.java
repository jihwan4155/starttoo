package com.starttoo.backend.notification;

import com.starttoo.backend.notification.api.DeviceDtos;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceDtoValidationTest {

    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void registrationAcceptsFirebaseInstallationId() {
        var request = new DeviceDtos.RegisterDeviceRequest(
                "c1234567890abcdefghijk",
                "ANDROID",
                "refresh-token"
        );

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void registrationRejectsBlankOrOversizedFirebaseInstallationId() {
        var blank = new DeviceDtos.RegisterDeviceRequest("", "ANDROID", "refresh-token");
        var oversized = new DeviceDtos.RegisterDeviceRequest(
                "f".repeat(129),
                "ANDROID",
                "refresh-token"
        );

        assertThat(validator.validate(blank))
                .anyMatch(violation -> "fid".equals(violation.getPropertyPath().toString()));
        assertThat(validator.validate(oversized))
                .anyMatch(violation -> "fid".equals(violation.getPropertyPath().toString()));
    }
}
