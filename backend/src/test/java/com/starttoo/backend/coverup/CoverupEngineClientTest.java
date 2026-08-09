package com.starttoo.backend.coverup;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.coverup.application.CoverupCircuitBreaker;
import com.starttoo.backend.coverup.application.CoverupEngineClient;
import com.starttoo.backend.coverup.config.CoverupProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class CoverupEngineClientTest {

    private static final String BASE_URL = "http://coverup-engine.test";
    private static final String SEARCH_BODY = """
            {
              "mode": "line",
              "count": 2,
              "results": [
                {"key": 183920, "score": 0.8590, "shape": 0.8590, "fill": 0.940, "opacity": 0.612},
                {"key": 200011, "score": 0.7130, "shape": 0.7130, "fill": 0.910, "opacity": 0.550}
              ],
              "timing_ms": {"prepare": 5.6, "stage1": 4.3, "stage2": 175.6, "total": 186.0},
              "candidates": 2000,
              "stage1": "on"
            }
            """;

    @Test
    void sendsOnlyTheThreeContractedFieldsAndKeepsTunedServerDefaults() {
        Fixture fixture = fixture(properties(true, ""));
        fixture.server()
                .expect(requestTo(BASE_URL + "/search"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                // strict=true 라 tau·w_cover 같은 값이 하나라도 섞이면 실패한다.
                .andExpect(content().json("""
                        {"mask_png_b64":"iVBORw0KGgo","mode":"line","top_k":24}
                        """, true))
                .andRespond(withSuccess(SEARCH_BODY, MediaType.APPLICATION_JSON));

        CoverupEngineClient.SearchResponse response =
                fixture.client().search("iVBORw0KGgo", CoverupEngineClient.EngineMode.LINE);

        assertThat(response.results())
                .extracting(CoverupEngineClient.Hit::key)
                .containsExactly(183920L, 200011L);
        assertThat(response.candidates()).isEqualTo(2000);
        assertThat(response.timingMs()).containsEntry("total", 186.0);
        fixture.server().verify();
    }

    @Test
    void attachesInternalTokenHeaderWhenConfigured() {
        Fixture fixture = fixture(properties(true, "secret-token"));
        fixture.server()
                .expect(requestTo(BASE_URL + "/search"))
                .andExpect(header("X-Internal-Token", "secret-token"))
                .andRespond(withSuccess(SEARCH_BODY, MediaType.APPLICATION_JSON));

        fixture.client().search("iVBORw0KGgo", CoverupEngineClient.EngineMode.LINE);

        fixture.server().verify();
    }

    @Test
    void decodeFailureIsPassedThroughAsBadRequest() {
        Fixture fixture = fixture(properties(true, ""));
        fixture.server()
                .expect(requestTo(BASE_URL + "/search"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"detail\": \"base64 디코딩 실패: invalid\"}"));

        assertThatThrownBy(() ->
                fixture.client().search("!!", CoverupEngineClient.EngineMode.LINE))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
                    assertThat(exception.getMessage()).contains("base64 디코딩 실패");
                });
    }

    @Test
    void modeRejectionIsOurBugSoItBecomesInternalServerError() {
        Fixture fixture = fixture(properties(true, ""));
        fixture.server()
                .expect(requestTo(BASE_URL + "/search"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"detail\": \"mode 는 line 만 지원한다: gate\"}"));

        assertThatThrownBy(() ->
                fixture.client().search("iVBORw0KGgo", CoverupEngineClient.EngineMode.LINE))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR));
    }

    @Test
    void schemaValidationFailureBecomesInternalServerError() {
        Fixture fixture = fixture(properties(true, ""));
        fixture.server()
                .expect(requestTo(BASE_URL + "/search"))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"detail\": [{\"loc\": [\"body\", \"top_k\"]}]}"));

        assertThatThrownBy(() ->
                fixture.client().search("iVBORw0KGgo", CoverupEngineClient.EngineMode.LINE))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR));
    }

    @Test
    void warmupAndOverloadBecomeServiceUnavailableAndCountTowardTheCircuit() {
        CoverupProperties properties = properties(true, "");
        CoverupCircuitBreaker circuitBreaker = new CoverupCircuitBreaker(properties);
        Fixture fixture = fixture(properties, circuitBreaker);
        fixture.server()
                .expect(requestTo(BASE_URL + "/search"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"detail\": \"워밍업 중\"}"));

        assertThatThrownBy(() ->
                fixture.client().search("iVBORw0KGgo", CoverupEngineClient.EngineMode.LINE))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE));
        assertThat(circuitBreaker.isOpen()).isTrue();
    }

    @Test
    void openCircuitFailsFastWithoutCallingTheEngine() {
        CoverupProperties properties = properties(true, "");
        CoverupCircuitBreaker circuitBreaker = new CoverupCircuitBreaker(properties);
        circuitBreaker.recordFailure();
        Fixture fixture = fixture(properties, circuitBreaker);

        assertThatThrownBy(() ->
                fixture.client().search("iVBORw0KGgo", CoverupEngineClient.EngineMode.LINE))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE));
        // 호출 자체가 없었으므로 등록해둔 기대가 하나도 소비되지 않는다.
        fixture.server().verify();
    }

    @Test
    void disabledEngineRejectsSearchWithoutCallingIt() {
        Fixture fixture = fixture(properties(false, ""));

        assertThatThrownBy(() ->
                fixture.client().search("iVBORw0KGgo", CoverupEngineClient.EngineMode.LINE))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE));
        fixture.server().verify();
    }

    @Test
    void removalTreatsUnknownKeyAsAlreadyRemoved() {
        Fixture fixture = fixture(properties(true, ""));
        fixture.server()
                .expect(requestTo(BASE_URL + "/designs/183920"))
                .andExpect(method(org.springframework.http.HttpMethod.DELETE))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"detail\": \"없는 key: 183920\"}"));

        assertThat(fixture.client().remove(183920L)).isTrue();
    }

    @Test
    void indexingSendsKeyAndImageAndReportsRejection() {
        Fixture fixture = fixture(properties(true, ""));
        fixture.server()
                .expect(requestTo(BASE_URL + "/designs"))
                .andExpect(content().json("""
                        {"key":183920,"image_b64":"aW1hZ2U="}
                        """, true))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"detail\": \"이미지 디코딩 실패 또는 빈 마스크\"}"));

        assertThat(fixture.client().index(183920L, "aW1hZ2U=")).isFalse();
        fixture.server().verify();
    }

    private Fixture fixture(CoverupProperties properties) {
        return fixture(properties, new CoverupCircuitBreaker(properties));
    }

    private Fixture fixture(CoverupProperties properties, CoverupCircuitBreaker circuitBreaker) {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.baseUrl(BASE_URL).build();
        return new Fixture(
                server,
                new CoverupEngineClient(
                        restClient,
                        restClient,
                        properties,
                        circuitBreaker,
                        new ObjectMapper()
                )
        );
    }

    private CoverupProperties properties(boolean enabled, String internalToken) {
        return new CoverupProperties(
                enabled,
                BASE_URL,
                internalToken,
                Duration.ofSeconds(3),
                Duration.ofSeconds(30),
                24,
                16,
                102400,
                Duration.ofHours(1),
                1,
                Duration.ofSeconds(30),
                50
        );
    }

    private record Fixture(MockRestServiceServer server, CoverupEngineClient client) {
    }
}
