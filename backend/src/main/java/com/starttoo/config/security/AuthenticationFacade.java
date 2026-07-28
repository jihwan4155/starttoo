package com.starttoo.config.security;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class AuthenticationFacade {

    public Long requireUserId() {
        return optionalUserId().orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
    }

    public Optional<Long> optionalUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
                || !authentication.isAuthenticated()) {
            return Optional.empty();
        }

        try {
            return Optional.of(Long.valueOf(jwtAuthentication.getToken().getSubject()));
        } catch (NumberFormatException exception) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
    }
}
