package com.starttoo.backend.auth.application;

import com.starttoo.backend.auth.api.AuthDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OAuthLoginService {

    private final OAuthTokenExchanger tokenExchanger;
    private final OAuthSubjectResolver subjectResolver;
    private final AuthService authService;

    public AuthDtos.SocialLoginResponse socialLogin(AuthDtos.SocialLoginRequest request) {
        String accessToken = resolveAccessToken(request);
        OAuthSubjectResolver.OAuthSubject subject =
                subjectResolver.resolve(request.provider(), accessToken);
        return authService.socialLogin(subject);
    }

    /**
     * 네이티브 앱은 액세스 토큰을 직접 보내고, 웹은 authorization code를 보낸다.
     * 코드로 들어오면 서버가 제공자 토큰 엔드포인트에서 액세스 토큰으로 교환한다.
     * 둘 중 하나만 채워져 있다는 것은 요청 DTO 검증에서 이미 보장된다.
     */
    private String resolveAccessToken(AuthDtos.SocialLoginRequest request) {
        String accessToken = request.accessToken();
        if (accessToken != null && !accessToken.isBlank()) {
            return accessToken;
        }
        return tokenExchanger.exchange(
                request.provider(),
                request.authorizationCode(),
                request.redirectUri()
        );
    }
}
