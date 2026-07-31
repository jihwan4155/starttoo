package com.starttoo.backend.coverup;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.coverup.api.CoverupDtos;
import com.starttoo.backend.coverup.application.CoverupEngineClient;
import com.starttoo.backend.coverup.application.CoverupEngineClient.EngineMode;
import com.starttoo.backend.coverup.application.CoverupEngineClient.Hit;
import com.starttoo.backend.coverup.application.CoverupSearchService;
import com.starttoo.backend.coverup.config.CoverupProperties;
import com.starttoo.backend.media.application.MediaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoverupSearchServiceTest {

    @Mock
    private CoverupEngineClient engineClient;

    @Mock
    private MediaService mediaService;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    private CoverupSearchService service;

    @BeforeEach
    void setUp() {
        service = new CoverupSearchService(
                engineClient,
                properties(),
                mediaService,
                namedParameterJdbcTemplate
        );
    }

    @Test
    void resultsFollowEngineScoreOrderNotDatabaseOrder() {
        stubEngine(EngineMode.GATE, hit(30L, 0.91), hit(10L, 0.8590), hit(20L, 0.42));
        // DB 는 tattoo_seq 오름차순으로 돌려준다. 검색 순위와 무관한 순서다.
        stubMeta(row(10L), row(20L), row(30L));
        stubPresign();

        CoverupDtos.SearchResponse response = service.search(request("coverup"));

        assertThat(response.results())
                .extracting(CoverupDtos.DesignResult::tattooSeq)
                .containsExactly(30L, 10L, 20L);
        assertThat(response.results())
                .extracting(CoverupDtos.DesignResult::score)
                .containsExactly(0.91, 0.86, 0.42);
        assertThat(response.mode()).isEqualTo("coverup");
        assertThat(response.count()).isEqualTo(3);
    }

    @Test
    void deletedDesignsAreExcludedAndTheQueryChecksAllThreeTables() {
        stubEngine(EngineMode.GATE, hit(10L, 0.9), hit(20L, 0.8), hit(30L, 0.7));
        // 20번은 세 테이블 중 하나가 삭제돼 조회에서 빠진 상태다.
        stubMeta(row(10L), row(30L));
        stubPresign();

        CoverupDtos.SearchResponse response = service.search(request("coverup"));

        assertThat(response.results())
                .extracting(CoverupDtos.DesignResult::tattooSeq)
                .containsExactly(10L, 30L);
        assertThat(response.count()).isEqualTo(2);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(namedParameterJdbcTemplate).query(
                sql.capture(),
                any(SqlParameterSource.class),
                ArgumentMatchers.<RowMapper<Object>>any()
        );
        assertThat(sql.getValue())
                .contains("t.is_deleted = FALSE")
                .contains("td.is_deleted = FALSE")
                .contains("i.is_deleted = FALSE")
                // 정렬은 자바에서 한다. SQL 정렬이 생기면 순위가 조용히 뒤집힌다.
                .doesNotContain("ORDER BY");
    }

    @Test
    void trimsToTheConfiguredResultSizeEvenWhenTheEngineReturnsMore() {
        Hit[] hits = new Hit[24];
        for (int index = 0; index < hits.length; index++) {
            hits[index] = hit(100L + index, 0.9 - index * 0.01);
        }
        stubEngine(EngineMode.LINE, hits);
        Row[] rows = new Row[20];
        for (int index = 0; index < rows.length; index++) {
            rows[index] = row(100L + index);
        }
        stubMeta(rows);
        stubPresign();

        CoverupDtos.SearchResponse response = service.search(request("shape"));

        assertThat(response.results()).hasSize(16);
        assertThat(response.count()).isEqualTo(16);
        assertThat(response.results().get(0).tattooSeq()).isEqualTo(100L);
        assertThat(response.results().get(15).tattooSeq()).isEqualTo(115L);
    }

    @Test
    void everythingDeletedReturnsAnEmptyResultInsteadOfAnError() {
        stubEngine(EngineMode.GATE, hit(10L, 0.9), hit(20L, 0.8));
        stubMeta();

        CoverupDtos.SearchResponse response = service.search(request("coverup"));

        assertThat(response.results()).isEmpty();
        assertThat(response.count()).isZero();
        verify(mediaService, never()).presignedDownload(anyString(), any(Duration.class));
    }

    @Test
    void emptyEngineResultSkipsTheDatabaseEntirely() {
        when(engineClient.search(anyString(), any(EngineMode.class)))
                .thenReturn(new CoverupEngineClient.SearchResponse(
                        "gate", 0, List.of(), Map.of(), 0, "off"
                ));

        CoverupDtos.SearchResponse response = service.search(request("coverup"));

        assertThat(response.results()).isEmpty();
        verify(namedParameterJdbcTemplate, never()).query(
                anyString(),
                any(SqlParameterSource.class),
                ArgumentMatchers.<RowMapper<Object>>any()
        );
    }

    @Test
    void dataUrlPrefixIsStrippedBeforeTheEngineCall() {
        stubEngine(EngineMode.GATE, hit(10L, 0.9));
        stubMeta(row(10L));
        stubPresign();

        service.search(new CoverupDtos.SearchRequest(
                "data:image/png;base64,iVBORw0KGgo",
                "coverup"
        ));

        verify(engineClient).search("iVBORw0KGgo", EngineMode.GATE);
    }

    @Test
    void shapeModeMapsToLine() {
        stubEngine(EngineMode.LINE, hit(10L, 0.9));
        stubMeta(row(10L));
        stubPresign();

        service.search(request("shape"));

        verify(engineClient).search(anyString(), ArgumentMatchers.eq(EngineMode.LINE));
    }

    @Test
    void oversizedMaskIsRejectedBeforeTheEngineIsCalled() {
        String oversized = "A".repeat(102401);

        assertThatThrownBy(() -> service.search(
                new CoverupDtos.SearchRequest(oversized, "coverup")
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MASK_TOO_LARGE));

        verify(engineClient, never()).search(anyString(), any(EngineMode.class));
    }

    @Test
    void unknownModeIsRejectedBeforeTheEngineIsCalled() {
        assertThatThrownBy(() -> service.search(request("gate")))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));

        verify(engineClient, never()).search(anyString(), any(EngineMode.class));
    }

    @Test
    void imageUrlsUseTheLongPresignExpiryNotTheShortDefault() {
        stubEngine(EngineMode.GATE, hit(10L, 0.9));
        stubMeta(row(10L));
        stubPresign();

        CoverupDtos.SearchResponse response = service.search(request("coverup"));

        assertThat(response.results().get(0).imageUrl())
                .isEqualTo("https://minio.test/designs/10.png");
        verify(mediaService).presignedDownload("designs/10.png", Duration.ofHours(1));
        verify(mediaService, never()).presignedDownload(anyString());
    }

    private CoverupDtos.SearchRequest request(String mode) {
        return new CoverupDtos.SearchRequest("iVBORw0KGgo", mode);
    }

    private void stubEngine(EngineMode mode, Hit... hits) {
        when(engineClient.search(anyString(), ArgumentMatchers.eq(mode)))
                .thenReturn(new CoverupEngineClient.SearchResponse(
                        mode.wireValue(),
                        hits.length,
                        List.of(hits),
                        Map.of("total", 186.0),
                        2000,
                        "on"
                ));
    }

    private void stubMeta(Row... rows) {
        when(namedParameterJdbcTemplate.query(
                anyString(),
                any(SqlParameterSource.class),
                ArgumentMatchers.<RowMapper<Object>>any()
        )).thenAnswer(invocation -> {
            RowMapper<Object> mapper = invocation.getArgument(2);
            List<Object> mapped = new ArrayList<>();
            for (Row row : rows) {
                mapped.add(mapper.mapRow(resultSet(row), 0));
            }
            return mapped;
        });
    }

    private void stubPresign() {
        when(mediaService.presignedDownload(anyString(), any(Duration.class)))
                .thenAnswer(invocation -> new MediaService.PresignedDownload(
                        "https://minio.test/" + invocation.getArgument(0),
                        OffsetDateTime.now().plusHours(1)
                ));
    }

    private ResultSet resultSet(Row row) throws SQLException {
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getLong("tattoo_seq")).thenReturn(row.tattooSeq());
        when(resultSet.getString("object_key")).thenReturn(row.objectKey());
        when(resultSet.getString("style_code")).thenReturn(row.styleCode());
        when(resultSet.getString("style_name")).thenReturn(row.styleName());
        return resultSet;
    }

    private Hit hit(long key, double score) {
        return new Hit(key, score);
    }

    private Row row(long tattooSeq) {
        return new Row(
                tattooSeq,
                "designs/" + tattooSeq + ".png",
                "geometric_ornamental",
                "기하·장식"
        );
    }

    private CoverupProperties properties() {
        return new CoverupProperties(
                true,
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

    private record Row(Long tattooSeq, String objectKey, String styleCode, String styleName) {
    }
}
