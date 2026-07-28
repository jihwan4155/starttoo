package com.starttoo.domain.auth.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.domain.auth.dto.AccessTokenResponse;
import com.starttoo.domain.user.entity.UserEntity;
import com.starttoo.domain.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestAuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtTokenService jwtTokenService;

    @InjectMocks
    private TestAuthService testAuthService;

    @Test
    void activeUserReceivesAccessTokenWithDatabaseRole() {
        UserEntity user = UserEntity.builder()
                .userId(7L)
                .oauthProvider("KAKAO")
                .oauthSubject("test-7")
                .nickname("needlemoon")
                .profileImageKey("system/profile/default-profile.webp")
                .role("ARTIST")
                .accountStatus("ACTIVE")
                .build();
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(jwtTokenService.issueAccessToken(7L, "ARTIST"))
                .thenReturn(new AccessTokenResponse("signed-token", "Bearer", Instant.now().plusSeconds(1800)));
        when(jwtTokenService.accessTokenSeconds()).thenReturn(1800L);

        var response = testAuthService.login(7L);

        assertThat(response.accessToken()).isEqualTo("signed-token");
        assertThat(response.user().role()).isEqualTo("ARTIST");
        verify(jwtTokenService).issueAccessToken(7L, "ARTIST");
    }

    @Test
    void suspendedUserCannotReceiveToken() {
        UserEntity user = UserEntity.builder()
                .userId(8L)
                .oauthProvider("GOOGLE")
                .oauthSubject("test-8")
                .nickname("suspended-user")
                .profileImageKey("system/profile/default-profile.webp")
                .role("USER")
                .accountStatus("SUSPENDED")
                .build();
        when(userRepository.findById(8L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> testAuthService.login(8L))
                .isInstanceOf(BusinessException.class);
    }
}
