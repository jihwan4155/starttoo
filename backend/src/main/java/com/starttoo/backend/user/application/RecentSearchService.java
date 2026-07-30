package com.starttoo.backend.user.application;

import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecentSearchService {

    private static final int MAX_TERMS = 10;
    private static final int FLUSH_BATCH_SIZE = 1_000;
    private static final Duration CACHE_TTL = Duration.ofDays(30);
    private static final Duration LIST_CACHE_TTL = Duration.ofDays(31);
    private static final String DIRTY_SET = "recent-search:dirty-users";
    private static final String LOADED_PREFIX = "recent-search:loaded:";
    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> INITIALIZE_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('EXISTS', KEYS[2]) == 1 then
                        return redis.call('LRANGE', KEYS[1], 0, tonumber(ARGV[3]) - 1)
                    end
                    redis.call('DEL', KEYS[1])
                    for index = 4, #ARGV do
                        redis.call('RPUSH', KEYS[1], ARGV[index])
                    end
                    if redis.call('EXISTS', KEYS[1]) == 1 then
                        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
                    end
                    redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[2]))
                    return redis.call('LRANGE', KEYS[1], 0, tonumber(ARGV[3]) - 1)
                    """, List.class);
    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> ADD_SCRIPT =
            new DefaultRedisScript<>("""
                    redis.call('LREM', KEYS[1], 0, ARGV[1])
                    redis.call('LPUSH', KEYS[1], ARGV[1])
                    redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]) - 1)
                    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
                    redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[4]))
                    redis.call('SADD', KEYS[3], ARGV[5])
                    return redis.call('LRANGE', KEYS[1], 0, tonumber(ARGV[2]) - 1)
                    """, List.class);
    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> REMOVE_SCRIPT =
            new DefaultRedisScript<>("""
                    redis.call('LREM', KEYS[1], 0, ARGV[1])
                    if redis.call('EXISTS', KEYS[1]) == 1 then
                        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
                    end
                    redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[4]))
                    redis.call('SADD', KEYS[3], ARGV[5])
                    return redis.call('LRANGE', KEYS[1], 0, tonumber(ARGV[2]) - 1)
                    """, List.class);

    private final StringRedisTemplate redisTemplate;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    public List<String> get(Integer userSeq) {
        String key = key(userSeq);
        try {
            if (Boolean.TRUE.equals(redisTemplate.hasKey(loadedKey(userSeq)))) {
                List<String> cached = redisTemplate.opsForList().range(key, 0, MAX_TERMS - 1);
                return cached == null ? List.of() : cached;
            }
        } catch (RuntimeException exception) {
            // 변경: 조회는 Redis 장애가 발생해도 PostgreSQL의 최근 스냅샷으로 계속 제공한다.
            log.warn("최근 검색어 Redis 조회 실패로 DB 배열을 사용합니다. userSeq={}",
                    userSeq, exception);
            return storedTerms(userSeq);
        }
        List<String> stored = storedTerms(userSeq);
        Object[] arguments = new Object[stored.size() + 3];
        arguments[0] = Long.toString(LIST_CACHE_TTL.toSeconds());
        arguments[1] = Long.toString(CACHE_TTL.toSeconds());
        arguments[2] = Integer.toString(MAX_TERMS);
        for (int index = 0; index < stored.size(); index++) {
            arguments[index + 3] = stored.get(index);
        }
        try {
            List<String> initialized = execute(
                    INITIALIZE_SCRIPT,
                    List.of(key, loadedKey(userSeq)),
                    arguments
            );
            return initialized == null ? List.of() : initialized;
        } catch (RuntimeException exception) {
            // 변경: DB 조회는 성공했으므로 캐시 초기화 실패만으로 조회 API를 실패시키지 않는다.
            log.warn("최근 검색어 Redis 초기화 실패로 DB 배열을 반환합니다. userSeq={}",
                    userSeq, exception);
            return stored;
        }
    }

    public List<String> add(Integer userSeq, String rawTerm) {
        String term = rawTerm.trim();
        if (term.isEmpty()) {
            return get(userSeq);
        }
        get(userSeq);
        try {
            List<String> values = execute(
                    ADD_SCRIPT,
                    List.of(key(userSeq), loadedKey(userSeq), DIRTY_SET),
                    term,
                    Integer.toString(MAX_TERMS),
                    Long.toString(LIST_CACHE_TTL.toSeconds()),
                    Long.toString(CACHE_TTL.toSeconds()),
                    userSeq.toString()
            );
            return values == null ? List.of() : values;
        } catch (RuntimeException exception) {
            throw unavailable(exception);
        }
    }

    public List<String> remove(Integer userSeq, String term) {
        get(userSeq);
        try {
            List<String> values = execute(
                    REMOVE_SCRIPT,
                    List.of(key(userSeq), loadedKey(userSeq), DIRTY_SET),
                    term,
                    Integer.toString(MAX_TERMS),
                    Long.toString(LIST_CACHE_TTL.toSeconds()),
                    Long.toString(CACHE_TTL.toSeconds()),
                    userSeq.toString()
            );
            return values == null ? List.of() : values;
        } catch (RuntimeException exception) {
            throw unavailable(exception);
        }
    }

    @Scheduled(fixedDelayString = "${app.search.recent-write-behind-delay:60000}")
    public void flushDirtyUsers() {
        for (int index = 0; index < FLUSH_BATCH_SIZE; index++) {
            String member = redisTemplate.opsForSet().pop(DIRTY_SET);
            if (member == null) {
                return;
            }
            try {
                flush(Integer.valueOf(member));
            } catch (RuntimeException exception) {
                redisTemplate.opsForSet().add(DIRTY_SET, member);
                log.warn("최근 검색어 DB 반영에 실패해 재시도 대상으로 복구했습니다. userSeq={}",
                        member, exception);
                return;
            }
        }
    }

    @Transactional
    public void flush(Integer userSeq) {
        List<String> terms = redisTemplate.opsForList().range(key(userSeq), 0, MAX_TERMS - 1);
        String[] array = terms == null ? new String[0] : terms.toArray(String[]::new);
        jdbcTemplate.update(
                """
                UPDATE users
                   SET recent_search_terms =
                           CASE WHEN ? = ''
                                THEN ARRAY[]::VARCHAR(100)[]
                                ELSE string_to_array(?, chr(1))::VARCHAR(100)[]
                           END,
                       mod_dttm = CURRENT_TIMESTAMP,
                       mod_usr_seq = NULL
                 WHERE user_seq = ?
                """,
                String.join("\u0001", array),
                String.join("\u0001", array),
                userSeq
        );
    }

    private String key(Integer userSeq) {
        return "recent-search:user:" + userSeq;
    }

    private String loadedKey(Integer userSeq) {
        return LOADED_PREFIX + userSeq;
    }

    private List<String> storedTerms(Integer userSeq) {
        User user = userRepository.findByUserSeqAndDeletedFalse(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.USER_NOT_FOUND));
        String[] terms = user.getRecentSearchTerms();
        return terms == null ? List.of() : Arrays.asList(terms);
    }

    private BusinessException unavailable(RuntimeException cause) {
        log.warn("최근 검색어 변경에 필요한 Redis를 사용할 수 없습니다.", cause);
        return new BusinessException(
                ErrorCode.SERVICE_UNAVAILABLE,
                "최근 검색어를 일시적으로 변경할 수 없습니다."
        );
    }

    @SuppressWarnings("unchecked")
    private List<String> execute(
            DefaultRedisScript<List> script,
            List<String> keys,
            Object... arguments
    ) {
        return (List<String>) redisTemplate.execute(script, keys, arguments);
    }
}
