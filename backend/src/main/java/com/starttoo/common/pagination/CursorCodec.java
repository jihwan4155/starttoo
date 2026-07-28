package com.starttoo.common.pagination;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class CursorCodec {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public String encode(Map<String, ?> values) {
        try {
            byte[] json = objectMapper.writeValueAsBytes(values);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(json);
        } catch (Exception exception) {
            throw new IllegalStateException("커서를 만들 수 없습니다.", exception);
        }
    }

    public Map<String, Object> decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return Map.of();
        }

        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor.getBytes(StandardCharsets.UTF_8));
            return objectMapper.readValue(decoded, MAP_TYPE);
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.INVALID_CURSOR);
        }
    }
}
