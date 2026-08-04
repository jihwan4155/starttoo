package com.starttoo.backend.tattoo.application;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.ResourceAccessException;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeoutException;

@Component
public class TattooModelClient {

    private final TattooModelRestClientFactory restClientFactory;
    private final AiProperties properties;

    public TattooModelClient(
            TattooModelRestClientFactory restClientFactory,
            AiProperties properties
    ) {
        this.restClientFactory = restClientFactory;
        this.properties = properties;
    }

    public Analysis analyze(String imageUrl) {
        return analyzeIfTattoo(imageUrl)
                .orElseThrow(() -> BusinessException.of(ErrorCode.NOT_TATTOO_IMAGE));
    }

    /**
     * 모델 처리 실패는 "타투가 아님" 과 구분한다. 전자는 재시도 대상이므로 502 로 올리고,
     * 후자만 빈 결과로 돌려 호출자가 422 로 변환하게 한다.
     */
    public Optional<Analysis> analyzeIfTattoo(String imageUrl) {
        AnalysisResult result = analyzeBatch(List.of(imageUrl)).get(0);
        if (result.failed()) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
        return result.tattoo() ? Optional.of(result.analysis()) : Optional.empty();
    }

    public List<AnalysisResult> analyzeBatch(List<String> imageUrls) {
        if (!properties.enabled()) {
            Analysis analysis = new Analysis(
                    "OTHER",
                    List.of(),
                    List.of("LINE"),
                    "BLACK",
                    List.of("SAMPLE")
            );
            return imageUrls.stream()
                    .map(ignored -> new AnalysisResult(AnalysisStatus.TATTOO, analysis))
                    .toList();
        }
        try {
            BatchAnalysisResponse response = restClient(imageUrls.size()).post()
                    .uri(properties.tattooBatchAnalysisPath())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new BatchImageRequest(imageUrls))
                    .retrieve()
                    .body(BatchAnalysisResponse.class);
            if (response == null || response.results() == null
                    || response.results().size() != imageUrls.size()) {
                throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
            }
            response.results().stream()
                    .filter(AnalysisResult::tattoo)
                    .map(AnalysisResult::analysis)
                    .forEach(this::validate);
            return response.results();
        } catch (BusinessException exception) {
            throw exception;
        } catch (ResourceAccessException exception) {
            if (hasTimeoutCause(exception)) {
                throw BusinessException.of(ErrorCode.PROCESSING_TIMEOUT);
            }
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        } catch (RestClientException exception) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    /**
     * 배치는 이미지를 한 장씩 순차로 추론하므로 장수에 비례해 시간이 늘어난다.
     */
    private RestClient restClient(int imageCount) {
        Duration readTimeout = properties.batchTimeoutPerImage()
                .multipliedBy(Math.max(imageCount, 1))
                .plus(properties.batchTimeoutOverhead());
        return restClientFactory.create(readTimeout);
    }

    private void validate(Analysis result) {
        if (result == null || result.primaryStyleCode() == null
                || result.primaryStyleCode().isBlank()) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
        if (result.secondaryStyleCodes() != null && result.secondaryStyleCodes().size() > 2) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
        if (result.renderingStyleCodes() != null && result.renderingStyleCodes().size() > 2) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    private boolean hasTimeoutCause(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SocketTimeoutException
                    || current instanceof HttpTimeoutException
                    || current instanceof TimeoutException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    public record ImageRequest(String imageUrl) {
    }

    public record BatchImageRequest(List<String> imageUrls) {
    }

    public record Detection(boolean isTattoo) {
    }

    public record BatchAnalysisResponse(List<AnalysisResult> results) {
    }

    /**
     * 모델이 이미지별로 내려주는 판별 상태. {@code NOT_TATTOO} 는 종료 상태이고
     * {@code FAILED} 만 재시도 대상이다. 이 둘을 하나의 boolean 으로 합치면
     * 처리 실패가 "타투 아닌 사진" 으로 조용히 흡수된다.
     */
    public enum AnalysisStatus {
        TATTOO,
        NOT_TATTOO,
        FAILED
    }

    public record AnalysisResult(
            AnalysisStatus status,
            Analysis analysis
    ) {
        public boolean tattoo() {
            return status == AnalysisStatus.TATTOO && analysis != null;
        }

        /** 상태가 비어 있으면(계약 이탈) 성공으로 보지 않고 재시도 대상으로 취급한다. */
        public boolean failed() {
            return status == null
                    || status == AnalysisStatus.FAILED
                    || status == AnalysisStatus.TATTOO && analysis == null;
        }
    }

    public record Analysis(
            String primaryStyleCode,
            List<String> secondaryStyleCodes,
            List<String> renderingStyleCodes,
            String colorCode,
            List<String> subjects
    ) {
    }
}
