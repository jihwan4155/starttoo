package com.starttoo.domain.auth.oauth;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class SocialOAuthClientRegistry {

    private final Map<String, SocialOAuthClient> clients;

    public SocialOAuthClientRegistry(List<SocialOAuthClient> clients) {
        this.clients = clients.stream().collect(Collectors.toUnmodifiableMap(
                SocialOAuthClient::provider,
                Function.identity()
        ));
    }

    public SocialOAuthClient require(String provider) {
        SocialOAuthClient client = clients.get(provider);
        if (client == null) {
            throw new BusinessException(ErrorCode.OAUTH_PROVIDER_UNSUPPORTED);
        }
        return client;
    }
}
