package com.starttoo.backend.auth;

import com.starttoo.backend.auth.api.AuthDtos;
import com.starttoo.backend.auth.application.AuthService;
import com.starttoo.backend.auth.application.OAuthLoginService;
import com.starttoo.backend.auth.application.OAuthSubjectResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthLoginServiceTest {

    @Mock
    private OAuthSubjectResolver subjectResolver;
    @Mock
    private AuthService authService;

    @InjectMocks
    private OAuthLoginService oauthLoginService;

    @Test
    void resolvesProviderBeforeEnteringDatabaseLoginUseCase() {
        AuthDtos.SocialLoginRequest request =
                new AuthDtos.SocialLoginRequest("KAKAO", "provider-token");
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
}
