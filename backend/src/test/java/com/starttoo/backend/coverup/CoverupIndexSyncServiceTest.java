package com.starttoo.backend.coverup;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.coverup.application.CoverupEngineClient;
import com.starttoo.backend.coverup.application.CoverupIndexSyncService;
import com.starttoo.backend.coverup.config.CoverupProperties;
import com.starttoo.backend.media.application.MediaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoverupIndexSyncServiceTest {

    @Mock
    private CoverupEngineClient engineClient;

    @Mock
    private MediaService mediaService;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void marksOnlyTheDesignsTheEngineAccepted() {
        CoverupIndexSyncService service = service(true);
        stubMissing(candidate(10L, "designs/10.png"), candidate(20L, "designs/20.png"));
        stubStale();
        when(mediaService.objectBytes("designs/10.png")).thenReturn(new byte[]{1, 2, 3});
        when(mediaService.objectBytes("designs/20.png")).thenReturn(new byte[]{4, 5, 6});
        when(engineClient.index(eq(10L), anyString())).thenReturn(true);
        when(engineClient.index(eq(20L), anyString())).thenReturn(false);

        service.synchronize();

        verify(engineClient).index(10L, "AQID");
        assertThat(capturedBatch("indexed = TRUE")).containsExactly(10L);
    }

    @Test
    void unreadableObjectIsSkippedWithoutCallingTheEngine() {
        CoverupIndexSyncService service = service(true);
        stubMissing(candidate(30L, "designs/30.png"));
        stubStale();
        when(mediaService.objectBytes("designs/30.png"))
                .thenThrow(BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE));

        service.synchronize();

        verify(engineClient, never()).index(anyLong(), anyString());
        verify(jdbcTemplate, never()).batchUpdate(anyString(), ArgumentMatchers.<List<Object[]>>any());
    }

    @Test
    void deletedDesignsAreRemovedFromTheIndexAndUnmarked() {
        CoverupIndexSyncService service = service(true);
        stubMissing();
        stubStale(40L, 50L);
        when(engineClient.remove(40L)).thenReturn(true);
        when(engineClient.remove(50L)).thenReturn(false);

        service.synchronize();

        assertThat(capturedBatch("indexed = FALSE")).containsExactly(40L);
    }

    @Test
    void disabledEngineSkipsTheWholeScan() {
        CoverupIndexSyncService service = service(false);

        service.synchronize();

        verifyNoInteractions(namedParameterJdbcTemplate, jdbcTemplate, engineClient, mediaService);
    }

    private List<Long> capturedBatch(String sqlFragment) {
        @SuppressWarnings("rawtypes")
        ArgumentCaptor<List> captor = ArgumentCaptor.forClass(List.class);
        verify(jdbcTemplate).batchUpdate(contains(sqlFragment), captor.capture());
        List<?> batch = captor.getValue();
        List<Long> keys = new ArrayList<>();
        for (Object arguments : batch) {
            keys.add((Long) ((Object[]) arguments)[0]);
        }
        return keys;
    }

    private void stubMissing(Candidate... candidates) {
        when(namedParameterJdbcTemplate.query(
                contains("td.indexed = FALSE"),
                any(SqlParameterSource.class),
                ArgumentMatchers.<RowMapper<Object>>any()
        )).thenAnswer(invocation -> {
            RowMapper<Object> mapper = invocation.getArgument(2);
            List<Object> mapped = new ArrayList<>();
            for (Candidate candidate : candidates) {
                mapped.add(mapper.mapRow(resultSet(candidate), 0));
            }
            return mapped;
        });
    }

    private void stubStale(Long... keys) {
        when(namedParameterJdbcTemplate.queryForList(
                contains("td.indexed = TRUE"),
                any(SqlParameterSource.class),
                eq(Long.class)
        )).thenReturn(Arrays.asList(keys));
    }

    private ResultSet resultSet(Candidate candidate) throws SQLException {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getLong("tattoo_seq")).thenReturn(candidate.tattooSeq());
        when(resultSet.getString("object_key")).thenReturn(candidate.objectKey());
        return resultSet;
    }

    private Candidate candidate(long tattooSeq, String objectKey) {
        return new Candidate(tattooSeq, objectKey);
    }

    private CoverupIndexSyncService service(boolean enabled) {
        return new CoverupIndexSyncService(
                properties(enabled),
                engineClient,
                mediaService,
                namedParameterJdbcTemplate,
                jdbcTemplate
        );
    }

    private CoverupProperties properties(boolean enabled) {
        return new CoverupProperties(
                enabled,
                "http://coverup-engine.test",
                "",
                Duration.ofSeconds(3),
                Duration.ofSeconds(30),
                24,
                16,
                102400,
                Duration.ofHours(1),
                5,
                Duration.ofSeconds(30),
                50
        );
    }

    private record Candidate(Long tattooSeq, String objectKey) {
    }
}
