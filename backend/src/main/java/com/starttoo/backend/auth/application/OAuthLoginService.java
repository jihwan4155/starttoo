package com.starttoo.backend.auth.application;

import com.starttoo.backend.auth.api.AuthDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OAuthLoginService {

    private final OAuthSubjectResolver subjectResolver;
    private final AuthService authService;

    public AuthDtos.SocialLoginResponse socialLogin(AuthDtos.SocialLoginRequest request) {
        OAuthSubjectResolver.OAuthSubject subject =
                subjectResolver.resolve(request.provider(), request.accessToken());
        return authService.socialLogin(subject);
    }
}
