package com.starttoo.backend.common.security;

import com.starttoo.backend.common.error.ApiErrorWriter;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class AccountStatusFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final ApiErrorWriter errorWriter;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwt)
                || !authentication.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }
        Integer userSeq;
        try {
            userSeq = Integer.valueOf(jwt.getToken().getSubject());
        } catch (NumberFormatException exception) {
            errorWriter.write(response, ErrorCode.INVALID_TOKEN);
            return;
        }
        var user = userRepository.findByUserSeqAndDeletedFalse(userSeq);
        if (user.isEmpty()) {
            errorWriter.write(response, ErrorCode.UNAUTHORIZED);
            return;
        }
        ErrorCode statusError = switch (user.get().getAccountStatus()) {
            case ACTIVE -> null;
            case SUSPENDED -> ErrorCode.ACCOUNT_SUSPENDED;
            case BANNED -> ErrorCode.ACCOUNT_BANNED;
            case WITHDRAWN -> ErrorCode.ACCOUNT_WITHDRAWN;
        };
        if (statusError != null) {
            errorWriter.write(response, statusError);
            return;
        }
        filterChain.doFilter(request, response);
    }
}
