package com.starttoo.backend.auth;

import com.starttoo.backend.auth.application.PhoneNumberNormalizer;
import com.starttoo.backend.common.error.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneNumberNormalizerTest {

    private final PhoneNumberNormalizer normalizer = new PhoneNumberNormalizer();

    @Test
    void stripsHyphensAndSpacesAndNormalizesKoreanMobileNumber() {
        assertThat(normalizer.normalizeKorean("010-1234 5678"))
                .isEqualTo("+821012345678");
    }

    @Test
    void rejectsInvalidPhoneNumber() {
        assertThatThrownBy(() -> normalizer.normalizeKorean("010-12"))
                .isInstanceOf(BusinessException.class);
    }
}
