package com.starttoo.backend.search;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.starttoo.backend.common.config.MinioProperties;
import com.starttoo.backend.search.application.SearchLogService;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.Result;
import io.minio.messages.Item;
import okhttp3.Headers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.ZSetOperations;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SearchLogServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ZSetOperations<String, String> zSetOperations;

    @Mock
    private ListOperations<String, String> listOperations;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private MinioClient minioClient;

    private SearchLogService searchLogService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        when(redisTemplate.opsForList()).thenReturn(listOperations);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        searchLogService = new SearchLogService(
                redisTemplate,
                new ObjectMapper(),
                minioClient,
                new MinioProperties(
                        "http://localhost:9000",
                        "http://localhost:9000",
                        "starttoo",
                        "secret",
                        "starttoo",
                        15L * 1024 * 1024,
                        Duration.ofMinutes(10),
                        Duration.ofMinutes(10)
                )
        );
    }

    @Test
    void restoresLatestSnapshotAndSubsequentMinioLog() throws Exception {
        when(zSetOperations.zCard("search:subjects:query-count")).thenReturn(0L);
        Item snapshotItem = item("search-count-snapshots/20260731.json");
        Item logItem = item("search-logs/2026-07-31/events.jsonl");
        when(minioClient.listObjects(any(ListObjectsArgs.class)))
                .thenReturn(List.of(new Result<>(snapshotItem)))
                .thenReturn(List.of(new Result<>(logItem)));
        when(minioClient.getObject(any(GetObjectArgs.class)))
                .thenReturn(response(
                        "search-count-snapshots/20260731.json",
                        """
                        {
                          "eventSequence":2,
                          "generatedDttm":"2026-07-31T00:00:00Z",
                          "counts":[{"subjectSeq":10,"count":3.0}]
                        }
                        """
                ))
                .thenReturn(response(
                        "search-logs/2026-07-31/events.jsonl",
                        """
                        {"eventSequence":3,"resolvedSubjectSeq":10}
                        """
                ));
        when(listOperations.range("search:logs:pending", 0, -1))
                .thenReturn(List.of());

        searchLogService.restoreSubjectCountsIfMissing();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Set<ZSetOperations.TypedTuple<String>>> tuples =
                ArgumentCaptor.forClass(Set.class);
        verify(zSetOperations).add(
                org.mockito.ArgumentMatchers.eq("search:subjects:query-count"),
                tuples.capture()
        );
        assertThat(tuples.getValue()).singleElement().satisfies(tuple -> {
            assertThat(tuple.getValue()).isEqualTo("10");
            assertThat(tuple.getScore()).isEqualTo(4.0);
        });
        verify(valueOperations).set("search:subjects:event-sequence", "3");
    }

    private Item item(String objectName) {
        Item item = mock(Item.class);
        when(item.objectName()).thenReturn(objectName);
        return item;
    }

    private GetObjectResponse response(String objectName, String content) {
        return new GetObjectResponse(
                new Headers.Builder().build(),
                "starttoo",
                null,
                objectName,
                new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))
        );
    }
}
