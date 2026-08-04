package com.starttoo.backend.post;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.starttoo.backend.post.api.PostDtos;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * application.yml 의 {@code spring.jackson.default-property-inclusion: non_null} 아래에서도
 * tattooSeq 키가 응답에 남아야 한다. 키가 사라지면 프론트엔드가 "아직 분류 전"과
 * "필드가 없는 응답"을 구분하려고 키 존재 검사를 해야 한다.
 */
class PostDtosSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    @Test
    void keepsTattooSeqKeyAsNullBeforeClassificationCompletes() throws Exception {
        String json = objectMapper.writeValueAsString(new PostDtos.PostImageResponse(
                41L,
                61L,
                "https://minio.test/61",
                null,
                (short) 1
        ));

        assertThat(json).contains("\"tattooSeq\":null");
        assertThat(objectMapper.readTree(json).has("tattooSeq")).isTrue();
    }

    @Test
    void serializesTattooSeqOnceClassificationCompleted() throws Exception {
        String json = objectMapper.writeValueAsString(new PostDtos.PostImageResponse(
                41L,
                61L,
                "https://minio.test/61",
                71L,
                (short) 1
        ));

        assertThat(json).contains("\"tattooSeq\":71");
    }
}
