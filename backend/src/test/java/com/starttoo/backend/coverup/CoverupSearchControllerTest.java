package com.starttoo.backend.coverup;

import com.starttoo.backend.common.error.ApiErrorWriter;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.common.error.GlobalExceptionHandler;
import com.starttoo.backend.coverup.api.CoverupDtos;
import com.starttoo.backend.coverup.api.CoverupSearchController;
import com.starttoo.backend.coverup.application.CoverupSearchService;
import com.starttoo.backend.user.domain.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CoverupSearchController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({GlobalExceptionHandler.class, ApiErrorWriter.class})
class CoverupSearchControllerTest {

    private final MockMvc mockMvc;

    @MockBean
    private CoverupSearchService coverupSearchService;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @MockBean
    private UserRepository userRepository;

    @Autowired
    CoverupSearchControllerTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void resultsAreReturnedInsideTheStandardDataEnvelope() throws Exception {
        when(coverupSearchService.search(any())).thenReturn(new CoverupDtos.SearchResponse(
                "coverup",
                1,
                List.of(new CoverupDtos.DesignResult(
                        183920L,
                        "https://minio.example/designs/183920.png?X-Amz-Signature=abc",
                        0.86,
                        "geometric_ornamental",
                        "기하·장식"
                ))
        ));

        mockMvc.perform(post("/v1/designs/search-by-shape")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maskPngB64":"iVBORw0KGgo","mode":"coverup"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mode").value("coverup"))
                .andExpect(jsonPath("$.data.count").value(1))
                .andExpect(jsonPath("$.data.results[0].tattooSeq").value(183920))
                .andExpect(jsonPath("$.data.results[0].score").value(0.86))
                .andExpect(jsonPath("$.data.results[0].styleName").value("기하·장식"))
                // 엔진 내부 지표는 어떤 경우에도 응답에 없어야 한다.
                .andExpect(jsonPath("$.data.results[0].fill").doesNotExist())
                .andExpect(jsonPath("$.data.results[0].opacity").doesNotExist())
                .andExpect(jsonPath("$.data.results[0].shape").doesNotExist());
    }

    @Test
    void blankMaskIsRejectedByValidation() throws Exception {
        mockMvc.perform(post("/v1/designs/search-by-shape")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maskPngB64":"","mode":"coverup"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void oversizedMaskIsRejectedWithFourHundred() throws Exception {
        when(coverupSearchService.search(any()))
                .thenThrow(BusinessException.of(ErrorCode.MASK_TOO_LARGE));

        mockMvc.perform(post("/v1/designs/search-by-shape")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maskPngB64":"iVBORw0KGgo","mode":"coverup"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MASK_TOO_LARGE"));
    }

    @Test
    void engineOutageSurfacesAsServiceUnavailable() throws Exception {
        when(coverupSearchService.search(any()))
                .thenThrow(BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE));

        mockMvc.perform(post("/v1/designs/search-by-shape")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"maskPngB64":"iVBORw0KGgo","mode":"coverup"}
                                """))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
    }
}
