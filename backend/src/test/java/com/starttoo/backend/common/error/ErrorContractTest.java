package com.starttoo.backend.common.error;

import com.starttoo.backend.user.domain.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ErrorContractController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({GlobalExceptionHandler.class, ApiErrorWriter.class})
class ErrorContractTest {

    private final MockMvc mockMvc;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @MockBean
    private UserRepository userRepository;

    @Autowired
    ErrorContractTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void successResponseContainsOnlyDataEnvelope() throws Exception {
        mockMvc.perform(get("/contract/success"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.value").value("ok"))
                .andExpect(jsonPath("$.code").doesNotExist())
                .andExpect(jsonPath("$.message").doesNotExist())
                .andExpect(jsonPath("$.timestamp").doesNotExist());
    }

    @Test
    void validationErrorUsesStableErrorContract() throws Exception {
        mockMvc.perform(post("/contract/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"value":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.errors[0].field").value("value"));
    }

    @Test
    void businessErrorKeepsHttpStatusAndCodeAligned() throws Exception {
        mockMvc.perform(get("/contract/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));
    }
}
