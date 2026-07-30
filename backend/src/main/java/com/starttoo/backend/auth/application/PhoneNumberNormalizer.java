package com.starttoo.backend.auth.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class PhoneNumberNormalizer {

    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");

    public String normalizeKorean(String input) {
        if (input == null) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        String value = input.replaceAll("[\\s-]", "");
        if (value.startsWith("010")) {
            value = "+82" + value.substring(1);
        } else if (value.startsWith("82")) {
            value = "+" + value;
        }
        if (!E164.matcher(value).matches()) {
            throw new BusinessException(
                    ErrorCode.INVALID_REQUEST,
                    "휴대폰 번호는 한국 번호 또는 E.164 형식이어야 합니다."
            );
        }
        return value;
    }
}
