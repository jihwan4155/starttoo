package com.starttoo.domain.auth.oauth;

public interface SocialOAuthClient {

    String provider();

    SocialProfile exchange(String authorizationCode, String redirectUri);
}
