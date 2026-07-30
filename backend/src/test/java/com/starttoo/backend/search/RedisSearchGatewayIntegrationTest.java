package com.starttoo.backend.search;

import com.starttoo.backend.search.application.RedisSearchGateway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.LockSupport;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class RedisSearchGatewayIntegrationTest {

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>(
            DockerImageName.parse("redis/redis-stack-server:latest")
    ).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static RedisSearchGateway gateway;

    @BeforeAll
    static void setUp() {
        RedisStandaloneConfiguration configuration = new RedisStandaloneConfiguration(
                REDIS.getHost(),
                REDIS.getMappedPort(6379)
        );
        connectionFactory = new LettuceConnectionFactory(configuration);
        connectionFactory.afterPropertiesSet();
        connectionFactory.start();

        StringRedisTemplate redisTemplate = new StringRedisTemplate(connectionFactory);
        redisTemplate.afterPropertiesSet();
        gateway = new RedisSearchGateway(redisTemplate);
        gateway.ensureIndexes();
    }

    @AfterAll
    static void tearDown() {
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
    }

    @Test
    void fuzzyCandidateIsGeneratedAndStaleDocumentIsRemoved() {
        gateway.replaceSubjects(Map.of(
                1, "rose",
                2, "butterfly"
        ));

        assertThat(awaitCandidates("roze"))
                .extracting(RedisSearchGateway.SearchCandidate::targetSeq)
                .contains(1);

        gateway.replaceSubjects(Map.of(2, "butterfly"));

        assertThat(awaitCandidates("rose"))
                .extracting(RedisSearchGateway.SearchCandidate::targetSeq)
                .doesNotContain(1);
    }

    @Test
    void candidatesKeepTheConfiguredTierOrder() {
        gateway.replaceAccounts(Map.of(
                1, "rose",
                2, "rosemary",
                3, "roze",
                4, "blackrose"
        ));

        List<RedisSearchGateway.SearchCandidate> candidates = awaitAccountCandidates("rose");

        assertThat(candidates)
                .extracting(RedisSearchGateway.SearchCandidate::matchTier)
                .containsSubsequence(
                        RedisSearchGateway.MatchTier.EXACT,
                        RedisSearchGateway.MatchTier.PREFIX,
                        RedisSearchGateway.MatchTier.CONTAINS
                );
    }

    private List<RedisSearchGateway.SearchCandidate> awaitCandidates(String query) {
        long deadline = System.nanoTime() + Duration.ofSeconds(3).toNanos();
        List<RedisSearchGateway.SearchCandidate> candidates;
        do {
            candidates = gateway.subjectCandidates(query, 20);
            if (!candidates.isEmpty()) {
                return candidates;
            }
            LockSupport.parkNanos(Duration.ofMillis(50).toNanos());
        } while (System.nanoTime() < deadline);
        return candidates;
    }

    private List<RedisSearchGateway.SearchCandidate> awaitAccountCandidates(String query) {
        long deadline = System.nanoTime() + Duration.ofSeconds(3).toNanos();
        List<RedisSearchGateway.SearchCandidate> candidates;
        do {
            candidates = gateway.accountCandidates(query, 20);
            if (candidates.size() >= 3) {
                return candidates;
            }
            LockSupport.parkNanos(Duration.ofMillis(50).toNanos());
        } while (System.nanoTime() < deadline);
        return candidates;
    }
}
