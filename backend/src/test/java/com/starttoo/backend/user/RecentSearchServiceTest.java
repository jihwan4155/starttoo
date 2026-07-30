package com.starttoo.backend.user;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.user.application.RecentSearchService;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecentSearchServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void getFallsBackToDatabaseArrayWhenRedisFails() {
        User user = mock(User.class);
        when(user.getRecentSearchTerms()).thenReturn(new String[]{"장미", "나비"});
        when(userRepository.findByUserSeqAndDeletedFalse(7)).thenReturn(Optional.of(user));
        when(redisTemplate.hasKey("recent-search:loaded:7"))
                .thenThrow(new RuntimeException("redis unavailable"));

        RecentSearchService service =
                new RecentSearchService(redisTemplate, userRepository, jdbcTemplate);

        assertThat(service.get(7)).containsExactly("장미", "나비");
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    @Test
    void addReturnsServiceUnavailableWhenRedisMutationFails() {
        User user = mock(User.class);
        when(user.getRecentSearchTerms()).thenReturn(new String[0]);
        when(userRepository.findByUserSeqAndDeletedFalse(7)).thenReturn(Optional.of(user));
        when(redisTemplate.hasKey("recent-search:loaded:7")).thenReturn(false);
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(Object[].class)))
                .thenThrow(new RuntimeException("redis unavailable"));

        RecentSearchService service =
                new RecentSearchService(redisTemplate, userRepository, jdbcTemplate);

        assertThatThrownBy(() -> service.add(7, "장미"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.SERVICE_UNAVAILABLE));
    }
}
