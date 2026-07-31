package com.starttoo.backend.auth;

import com.starttoo.backend.auth.api.AuthDtos;
import com.starttoo.backend.auth.application.AuthService;
import com.starttoo.backend.auth.application.OAuthLoginService;
import com.starttoo.backend.auth.application.OAuthSubjectResolver;
import com.starttoo.backend.auth.application.OAuthTokenExchanger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthLoginServiceTest {

    @Mock
    private OAuthTokenExchanger tokenExchanger;
    @Mock
    private OAuthSubjectResolver subjectResolver;
    @Mock
    private AuthService authService;

    @InjectMocks
    private OAuthLoginService oauthLoginService;

    @Test
    void resolvesProviderBeforeEnteringDatabaseLoginUseCase() {
        AuthDtos.SocialLoginRequest request =
                new AuthDtos.SocialLoginRequest("KAKAO", "provider-token", null, null);
        OAuthSubjectResolver.OAuthSubject subject =
                new OAuthSubjectResolver.OAuthSubject("KAKAO", "subject-1");
        AuthDtos.SocialLoginResponse expected =
                new AuthDtos.SocialLoginResponse(true, "signup-token", null);
        when(subjectResolver.resolve("KAKAO", "provider-token")).thenReturn(subject);
        when(authService.socialLogin(subject)).thenReturn(expected);

        assertThat(oauthLoginService.socialLogin(request)).isSameAs(expected);

        InOrder order = inOrder(subjectResolver, authService);
        order.verify(subjectResolver).resolve("KAKAO", "provider-token");
        order.verify(authService).socialLogin(subject);
    }

    @Test
    void skipsTokenExchangeWhenNativeAppSendsAccessToken() {
        AuthDtos.SocialLoginRequest request =
                new AuthDtos.SocialLoginRequest("GOOGLE", "provider-token", null, null);
        OAuthSubjectResolver.OAuthSubject subject =
                new OAuthSubjectResolver.OAuthSubject("GOOGLE", "subject-1");
        when(subjectResolver.resolve("GOOGLE", "provider-token")).thenReturn(subject);
        when(authService.socialLogin(subject))
                .thenReturn(new AuthDtos.SocialLoginResponse(true, "signup-token", null));

        oauthLoginService.socialLogin(request);

        verify(tokenExchanger, never()).exchange(any(), any(), any());
    }

    @Test
    void exchangesAuthorizationCodeBeforeResolvingSubject() {
        String redirectUri = "https://localhost:5173/auth/kakao/callback";
        AuthDtos.SocialLoginRequest request =
                new AuthDtos.SocialLoginRequest("KAKAO", null, "auth-code", redirectUri);
        OAuthSubjectResolver.OAuthSubject subject =
                new OAuthSubjectResolver.OAuthSubject("KAKAO", "subject-1");
        AuthDtos.SocialLoginResponse expected =
                new AuthDtos.SocialLoginResponse(false, null, null);
        when(tokenExchanger.exchange("KAKAO", "auth-code", redirectUri))
                .thenReturn("exchanged-token");
        when(subjectResolver.resolve("KAKAO", "exchanged-token")).thenReturn(subject);
        when(authService.socialLogin(subject)).thenReturn(expected);

        assertThat(oauthLoginService.socialLogin(request)).isSameAs(expected);

        InOrder order = inOrder(tokenExchanger, subjectResolver, authService);
        order.verify(tokenExchanger).exchange("KAKAO", "auth-code", redirectUri);
        order.verify(subjectResolver).resolve("KAKAO", "exchanged-token");
        order.verify(authService).socialLogin(subject);
    }
}
