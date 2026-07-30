package com.starttoo.backend.common.security;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Integer currentUserSeq() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !authentication.isAuthenticated()) {
            throw BusinessException.of(ErrorCode.UNAUTHORIZED);
        }
        try {
            return Integer.valueOf(jwt.getToken().getSubject());
        } catch (NumberFormatException exception) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
    }
}
