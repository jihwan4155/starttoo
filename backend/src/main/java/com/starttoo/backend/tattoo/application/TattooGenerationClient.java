package com.starttoo.backend.tattoo.application;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.starttoo.backend.common.config.AiProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.tattoo.api.TattooDtos;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.concurrent.TimeoutException;

@Component
public class TattooGenerationClient {

    private final RestClient restClient;
    private final AiProperties properties;
    private final MediaService mediaService;

    public TattooGenerationClient(
            @Qualifier("tattooGenerationRestClient") RestClient restClient,
            AiProperties properties,
            MediaService mediaService
    ) {
        this.restClient = restClient;
        this.properties = properties;
        this.mediaService = mediaService;
    }

    public GeneratedImage generate(
            Integer userSeq,
            TattooDtos.GenerateTattooRequest request
    ) {
        if (!properties.enabled()) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
        String referenceImageUrl = null;
        if (request.referenceImageSeq() != null && !request.style().contains("lettering")) {
            referenceImageUrl = mediaService.aiReferenceDownloadUrl(
                    userSeq,
                    request.referenceImageSeq()
            );
        }
        AiGenerateTattooRequest aiRequest = new AiGenerateTattooRequest(
                request.prompt(),
                request.style(),
                referenceImageUrl,
                request.seed(),
                request.steps(),
                request.guidance(),
                request.size()
        );
        try {
            ResponseEntity<byte[]> response = restClient.post()
                    .uri(properties.generationPath())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.IMAGE_PNG)
                    .body(aiRequest)
                    .retrieve()
                    .toEntity(byte[].class);
            byte[] content = response.getBody();
            MediaType contentType = response.getHeaders().getContentType();
            if (content == null || content.length == 0
                    || contentType == null || !MediaType.IMAGE_PNG.isCompatibleWith(contentType)) {
                throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
            }
            return new GeneratedImage(content, response.getHeaders());
        } catch (BusinessException exception) {
            throw exception;
        } catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            if (status == 400 || status == 422) {
                throw BusinessException.of(ErrorCode.VALIDATION_ERROR);
            }
            if (status == 429) {
                throw BusinessException.of(ErrorCode.RATE_LIMITED);
            }
            if (status == 503) {
                throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
            }
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        } catch (ResourceAccessException exception) {
            if (hasTimeoutCause(exception)) {
                throw BusinessException.of(ErrorCode.PROCESSING_TIMEOUT);
            }
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        } catch (RestClientException exception) {
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

    public record GeneratedImage(byte[] content, HttpHeaders headers) {
    }

    private record AiGenerateTattooRequest(
            String prompt,
            java.util.List<String> style,
            @JsonProperty("reference_image_url") String referenceImageUrl,
            Long seed,
            Integer steps,
            Double guidance,
            Integer size
    ) {
    }
}
