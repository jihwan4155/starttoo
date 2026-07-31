package com.starttoo.backend.tattoo.application;

import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

// TODO(model-integration): 외부 계약 확정 후 @Component로 다시 등록하고 TattooService에 주입한다.
public class TattooModelClient {

    private final RestClient restClient;
    private final AiProperties properties;

    public TattooModelClient(RestClient.Builder builder, AiProperties properties) {
        this.restClient = builder.baseUrl(properties.baseUrl()).build();
        this.properties = properties;
    }

    public Analysis analyze(String imageUrl) {
        if (!properties.enabled()) {
            return new Analysis("OTHER", List.of(), List.of("LINE"), "BLACK", List.of("타투"));
        }
        try {
            Detection detection = restClient.post()
                    .uri(properties.tattooDetectionPath())
                    .body(new ImageRequest(imageUrl))
                    .retrieve()
                    .body(Detection.class);
            if (detection == null || !detection.isTattoo()) {
                throw BusinessException.of(ErrorCode.NOT_TATTOO_IMAGE);
            }
            Analysis result = restClient.post()
                    .uri(properties.tattooAnalysisPath())
                    .body(new ImageRequest(imageUrl))
                    .retrieve()
                    .body(Analysis.class);
            if (result == null || result.primaryStyleCode() == null) {
                throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
            }
            validate(result);
            return result;
        } catch (BusinessException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    private void validate(Analysis result) {
        if (result.secondaryStyleCodes() != null && result.secondaryStyleCodes().size() > 2) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
        if (result.renderingStyleCodes() != null && result.renderingStyleCodes().size() > 2) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    public record ImageRequest(String imageUrl) {
    }

    public record Detection(boolean isTattoo) {
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
