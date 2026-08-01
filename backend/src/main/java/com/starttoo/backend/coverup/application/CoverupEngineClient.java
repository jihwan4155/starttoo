package com.starttoo.backend.coverup.application;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.coverup.config.CoverupProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

/**
 * 커버업 검색 엔진(내부 전용) 호출 담당.
 *
 * <p>엔진 계약은 snake_case 고정이다. 튜닝된 서버 기본값을 덮어쓰지 않도록
 * {@code w_shape}/{@code w_cover}/{@code tau}/{@code min_fill}/{@code min_opacity} 는
 * 요청 본문에 아예 넣지 않는다.
 */
@Slf4j
@Component
public class CoverupEngineClient {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final RestClient searchRestClient;
    private final RestClient indexRestClient;
    private final CoverupProperties properties;
    private final CoverupCircuitBreaker circuitBreaker;
    private final ObjectMapper objectMapper;

    public CoverupEngineClient(
            @Qualifier("coverupSearchRestClient") RestClient searchRestClient,
            @Qualifier("coverupIndexRestClient") RestClient indexRestClient,
            CoverupProperties properties,
            CoverupCircuitBreaker circuitBreaker,
            ObjectMapper objectMapper
    ) {
        this.searchRestClient = searchRestClient;
        this.indexRestClient = indexRestClient;
        this.properties = properties;
        this.circuitBreaker = circuitBreaker;
        this.objectMapper = objectMapper;
    }

    /**
     * 마스크로 도안을 검색한다. 엔진 장애는 여기서 503으로 끝내고 다른 기능에 전파하지 않는다.
     *
     * @param maskBase64 {@code data:} 접두어를 뗀 base64 문자열
     */
    public SearchResponse search(String maskBase64, EngineMode mode) {
        if (!properties.enabled()) {
            log.warn("Coverup engine disabled; search rejected");
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
        if (circuitBreaker.isOpen()) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
        try {
            SearchResponse response = searchRestClient.post()
                    .uri("/search")
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(this::applyInternalToken)
                    .body(new SearchRequest(maskBase64, mode.wireValue(), properties.engineTopK()))
                    .retrieve()
                    .body(SearchResponse.class);
            if (response == null || response.results() == null) {
                circuitBreaker.recordFailure();
                log.warn("Coverup engine returned an empty search body");
                throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
            }
            circuitBreaker.recordSuccess();
            logTiming(response);
            return response;
        } catch (RestClientResponseException exception) {
            throw mapSearchError(exception);
        } catch (RestClientException exception) {
            // 연결 실패·타임아웃. 엔진이 죽었거나 느려진 경우다.
            circuitBreaker.recordFailure();
            log.warn("Coverup engine search call failed: {}", exception.getMessage());
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    /**
     * 도안 1장을 색인한다. 색인 동기화 스캔에서만 쓴다.
     *
     * @return 색인 성공 여부. 실패해도 예외를 던지지 않고 다음 스캔에서 재시도한다.
     */
    public boolean index(long tattooSeq, String imageBase64) {
        if (!properties.enabled()) {
            return false;
        }
        try {
            indexRestClient.post()
                    .uri("/designs")
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(this::applyInternalToken)
                    .body(new DesignRequest(tattooSeq, imageBase64))
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientResponseException exception) {
            // 400은 이미지 자체가 색인 불가라는 뜻이다. 재시도해도 같은 결과다.
            log.warn(
                    "Coverup engine rejected design indexing: tattooSeq={} status={} detail={}",
                    tattooSeq,
                    exception.getStatusCode().value(),
                    detail(exception)
            );
            return false;
        } catch (RestClientException exception) {
            log.warn(
                    "Coverup engine indexing call failed: tattooSeq={} reason={}",
                    tattooSeq,
                    exception.getMessage()
            );
            return false;
        }
    }

    /**
     * 색인에서 도안을 제거한다.
     *
     * @return 제거 성공 여부. 엔진에 없던 key(404)도 목표 상태에 도달한 것이므로 성공으로 본다.
     */
    public boolean remove(long tattooSeq) {
        if (!properties.enabled()) {
            return false;
        }
        try {
            indexRestClient.delete()
                    .uri("/designs/{key}", tattooSeq)
                    .headers(this::applyInternalToken)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                return true;
            }
            log.warn(
                    "Coverup engine rejected design removal: tattooSeq={} status={} detail={}",
                    tattooSeq,
                    exception.getStatusCode().value(),
                    detail(exception)
            );
            return false;
        } catch (RestClientException exception) {
            log.warn(
                    "Coverup engine removal call failed: tattooSeq={} reason={}",
                    tattooSeq,
                    exception.getMessage()
            );
            return false;
        }
    }

    private BusinessException mapSearchError(RestClientResponseException exception) {
        int status = exception.getStatusCode().value();
        String detail = detail(exception);
        if (status == HttpStatus.BAD_REQUEST.value()) {
            if (isTeamServerBug(detail)) {
                // 프론트 잘못이 아니다. 우리가 보내지 말아야 할 값을 보냈다는 뜻이라 500으로 올린다.
                log.error("Coverup engine rejected a request built by this server: {}", detail);
                return BusinessException.of(ErrorCode.INTERNAL_SERVER_ERROR);
            }
            // base64/PNG 디코딩 실패·크기 초과. 프론트가 고칠 수 있는 오류라 그대로 전달한다.
            return new BusinessException(ErrorCode.INVALID_REQUEST, detail);
        }
        if (status == HttpStatus.UNPROCESSABLE_ENTITY.value()) {
            log.error("Coverup engine schema validation failed: {}", detail);
            return BusinessException.of(ErrorCode.INTERNAL_SERVER_ERROR);
        }
        // 503(워밍업 미완료·빈 스토어·동시 처리 한도)과 나머지 5xx는 모두 엔진 쪽 문제다.
        circuitBreaker.recordFailure();
        log.warn("Coverup engine unavailable: status={} detail={}", status, detail);
        return BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
    }

    /**
     * 엔진이 mode/tau 를 400으로 거절하는 경우는 팀 서버의 변환 버그뿐이다.
     * 우리는 mode 를 line/gate 로만 변환해 보내고 tau 는 아예 보내지 않으므로 정상 경로에서는 나오지 않는다.
     */
    private boolean isTeamServerBug(String detail) {
        return detail.startsWith("mode") || detail.startsWith("tau");
    }

    private void logTiming(SearchResponse response) {
        log.info(
                "Coverup search done: mode={} count={} candidates={} stage1={} timingMs={}",
                response.mode(),
                response.count(),
                response.candidates(),
                response.stage1(),
                response.timingMs()
        );
    }

    private void applyInternalToken(HttpHeaders headers) {
        String token = properties.internalToken();
        if (token != null && !token.isBlank()) {
            headers.set(INTERNAL_TOKEN_HEADER, token);
        }
    }

    private String detail(RestClientResponseException exception) {
        String body = exception.getResponseBodyAsString();
        if (body == null || body.isBlank()) {
            return "";
        }
        try {
            JsonNode node = objectMapper.readTree(body).get("detail");
            return node == null ? body : node.asText();
        } catch (Exception parseFailure) {
            return body;
        }
    }

    public enum EngineMode {
        LINE("line"),
        GATE("gate");

        private final String wireValue;

        EngineMode(String wireValue) {
            this.wireValue = wireValue;
        }

        public String wireValue() {
            return wireValue;
        }
    }

    private record SearchRequest(
            @JsonProperty("mask_png_b64") String maskPngB64,
            @JsonProperty("mode") String mode,
            @JsonProperty("top_k") int topK
    ) {
    }

    private record DesignRequest(
            @JsonProperty("key") long key,
            @JsonProperty("image_b64") String imageB64
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SearchResponse(
            @JsonProperty("mode") String mode,
            @JsonProperty("count") int count,
            @JsonProperty("results") List<Hit> results,
            @JsonProperty("timing_ms") Map<String, Double> timingMs,
            @JsonProperty("candidates") Integer candidates,
            @JsonProperty("stage1") String stage1
    ) {
    }

    /**
     * 엔진의 {@code key} 가 {@code tattoo_seq} 다.
     * 내부 지표(shape/fill/opacity/rec/prec/cover/weak)는 외부에 노출하지 않으므로 받지 않는다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Hit(
            @JsonProperty("key") long key,
            @JsonProperty("score") double score
    ) {
    }
}
