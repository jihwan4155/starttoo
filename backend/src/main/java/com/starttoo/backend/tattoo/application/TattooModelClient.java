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
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeoutException;

@Component
public class TattooModelClient {

    private final RestClient restClient;
    private final AiProperties properties;

    public TattooModelClient(RestClient.Builder builder, AiProperties properties) {
        this.restClient = builder.baseUrl(properties.baseUrl()).build();
        this.properties = properties;
    }

    public Analysis analyze(String imageUrl) {
        return analyzeIfTattoo(imageUrl)
                .orElseThrow(() -> BusinessException.of(ErrorCode.NOT_TATTOO_IMAGE));
    }

    public Optional<Analysis> analyzeIfTattoo(String imageUrl) {
        AnalysisResult result = analyzeBatch(List.of(imageUrl)).get(0);
        return result.isTattoo() ? Optional.of(result.analysis()) : Optional.empty();
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
                    .map(ignored -> new AnalysisResult(true, analysis))
                    .toList();
        }
        try {
            BatchAnalysisResponse response = restClient.post()
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
                    .filter(AnalysisResult::isTattoo)
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

    public record AnalysisResult(
            boolean isTattoo,
            Analysis analysis
    ) {
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
