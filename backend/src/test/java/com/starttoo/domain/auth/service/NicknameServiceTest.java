package com.starttoo.domain.auth.service;

import com.starttoo.common.exception.FieldBusinessException;
import com.starttoo.domain.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NicknameServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private NicknameService nicknameService;

    @Test
    void returnsAvailableWhenNicknameDoesNotExist() {
        when(userRepository.existsByNickname("needlemoon")).thenReturn(false);

        var response = nicknameService.checkAvailability(" needlemoon ");

        assertThat(response.nickname()).isEqualTo("needlemoon");
        assertThat(response.available()).isTrue();
    }

    @Test
    void returnsUnavailableWhenNicknameExists() {
        when(userRepository.existsByNickname("needlemoon")).thenReturn(true);

        var response = nicknameService.checkAvailability("needlemoon");

        assertThat(response.available()).isFalse();
    }

    @Test
    void rejectsTooShortNickname() {
        assertThatThrownBy(() -> nicknameService.checkAvailability("a"))
                .isInstanceOf(FieldBusinessException.class);
    }

    @Test
    void suggestsUnusedNickname() {
        when(userRepository.existsByNickname(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(false);

        var response = nicknameService.suggest();

        assertThat(response.nickname()).isNotBlank();
    }
}

