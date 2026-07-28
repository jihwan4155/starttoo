package com.starttoo.domain.auth.oauth;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

final class OAuthClientSupport {

    private OAuthClientSupport() {
    }

    static BusinessException translate(Exception exception) {
        if (exception instanceof ResourceAccessException) {
            return new BusinessException(ErrorCode.OAUTH_PROVIDER_TIMEOUT);
        }
        if (exception instanceof RestClientResponseException responseException
                && responseException.getStatusCode().is4xxClientError()) {
            return new BusinessException(ErrorCode.OAUTH_CODE_INVALID);
        }
        return new BusinessException(ErrorCode.OAUTH_PROVIDER_ERROR);
    }

    static void requireConfigured(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            throw new BusinessException(ErrorCode.SERVICE_NOT_CONFIGURED);
        }
    }
}
