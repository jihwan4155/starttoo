package com.starttoo.backend.auth.application;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;

@Component
public class SignupTokenDecoder {

    private final JwtDecoder decoder;

    public SignupTokenDecoder(@Qualifier("rawJwtDecoder") JwtDecoder decoder) {
        this.decoder = decoder;
    }

    public Jwt decode(String token) {
        return decoder.decode(token);
    }
}
