package com.starttoo.backend.search;

import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.application.PostService;
import com.starttoo.backend.search.api.SearchDtos;
import com.starttoo.backend.search.application.KoreanJamoNormalizer;
import com.starttoo.backend.search.application.RedisSearchGateway;
import com.starttoo.backend.search.application.SearchLogService;
import com.starttoo.backend.search.application.SearchService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SearchServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private KoreanJamoNormalizer jamoNormalizer;

    @Mock
    private SearchLogService searchLogService;

    @Mock
    private RedisSearchGateway redisSearchGateway;

    @Mock
    private PostService postService;

    @InjectMocks
    private SearchService searchService;

    @Test
    void subjectAutocompleteLoadsCurrentNamesFromSequenceOnlyMembers() throws Exception {
        when(jamoNormalizer.normalize("장")).thenReturn("ㅈㅏㅇ");
        doReturn(List.of("ㅈㅏㅇㅁㅣ\u000110", "ㅈㅏㅇㅅㅣㄱ\u000199"))
                .when(redisTemplate)
                .execute(
                        any(DefaultRedisScript.class),
                        anyList(),
                        any(Object[].class)
                );
        mockSubjectRows(Map.of(10, "장미"));

        List<SearchDtos.SubjectResult> results =
                searchService.autocompleteSubjects("장", 10);

        assertThat(results).containsExactly(new SearchDtos.SubjectResult(10, "장미"));
    }

    @Test
    void artistSearchRevalidatesVerifiedActiveArtistInPostgres() throws Exception {
        when(jamoNormalizer.normalize("Artist")).thenReturn("Artist");
        when(redisSearchGateway.artistCandidates("Artist", 200))
                .thenReturn(List.of(
                        new RedisSearchGateway.SearchCandidate(
                                8,
                                RedisSearchGateway.MatchTier.EXACT,
                                4.0,
                                0
                        ),
                        new RedisSearchGateway.SearchCandidate(
                                9,
                                RedisSearchGateway.MatchTier.PREFIX,
                                3.0,
                                1
                        )
                ));
        doAnswer(invocation -> {
            RowCallbackHandler handler = invocation.getArgument(2);
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getInt("user_seq")).thenReturn(8);
            when(resultSet.getString("nickname")).thenReturn("Artist");
            when(resultSet.getString("role")).thenReturn("ARTIST");
            handler.processRow(resultSet);
            return null;
        }).when(namedParameterJdbcTemplate).query(
                contains("FROM users u"),
                any(SqlParameterSource.class),
                any(RowCallbackHandler.class)
        );

        List<SearchDtos.AccountResult> results =
                searchService.searchAccounts("Artist", 20, true);

        assertThat(results).containsExactly(
                new SearchDtos.AccountResult(
                        8,
                        "Artist",
                        com.starttoo.backend.user.domain.UserRole.ARTIST
                )
        );
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SqlParameterSource> parameters =
                ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(namedParameterJdbcTemplate).query(
                sql.capture(),
                parameters.capture(),
                any(RowCallbackHandler.class)
        );
        assertThat(sql.getValue()).contains(
                "u.role <> 'ADMIN'",
                "u.account_status = 'ACTIVE'",
                "u.is_deleted = FALSE",
                "a.verification_status = 'VERIFIED'"
        );
        assertThat(parameters.getValue().getValue("artistsOnly")).isEqualTo(true);
    }

    @Test
    void postSearchUsesCanonicalSubjectAndStablePostCursor() throws Exception {
        when(jamoNormalizer.normalize("장믜")).thenReturn("ㅈㅏㅇㅁㅢ");
        when(redisSearchGateway.subjectCandidates("ㅈㅏㅇㅁㅢ", 250))
                .thenReturn(List.of(
                        new RedisSearchGateway.SearchCandidate(
                                10,
                                RedisSearchGateway.MatchTier.FUZZY_1,
                                2.5,
                                0
                        ),
                        new RedisSearchGateway.SearchCandidate(
                                11,
                                RedisSearchGateway.MatchTier.FUZZY_2,
                                9.0,
                                1
                        )
                ));
        mockSubjectRows(Map.of(10, "장미", 11, "장식"));
        when(namedParameterJdbcTemplate.queryForList(
                contains("FROM tattoo_subjects"),
                any(SqlParameterSource.class),
                eq(Long.class)
        )).thenReturn(List.of(31L, 21L, 11L));
        List<PostDtos.PostResponse> posts = List.of(post(31L), post(21L));
        when(postService.responsesBySeqs(List.of(31L, 21L), 7)).thenReturn(posts);

        SearchDtos.PostSearchResponse response =
                searchService.searchPosts(7, "장믜", 40L, 2);

        assertThat(response.query()).isEqualTo("장믜");
        assertThat(response.matchedSubject())
                .isEqualTo(new SearchDtos.SubjectResult(10, "장미"));
        assertThat(response.matchType()).isEqualTo("FUZZY_1");
        assertThat(response.items()).containsExactlyElementsOf(posts);
        assertThat(response.nextCursor()).isEqualTo("21");
        assertThat(response.hasNext()).isTrue();
        assertThat(response.size()).isEqualTo(2);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SqlParameterSource> parameters =
                ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(namedParameterJdbcTemplate).queryForList(
                sql.capture(),
                parameters.capture(),
                eq(Long.class)
        );
        assertThat(sql.getValue()).contains(
                "tattoo_subject.subject_seq = :subjectSeq",
                "author.account_status = 'ACTIVE'",
                "user_blocks",
                "post_hidden_preferences",
                "ORDER BY post.post_seq DESC"
        );
        assertThat(parameters.getValue().getValue("subjectSeq")).isEqualTo(10);
        assertThat(parameters.getValue().getValue("cursor")).isEqualTo(40L);
        verify(searchLogService).recordPostSearch(7, "장믜", 10, "장미");
    }

    @Test
    void postSearchReturnsEmptyContractWhenNoSubjectMatches() {
        when(jamoNormalizer.normalize("없는값")).thenReturn("normalized");
        when(redisSearchGateway.subjectCandidates("normalized", 250))
                .thenReturn(List.of());

        SearchDtos.PostSearchResponse response =
                searchService.searchPosts(null, "없는값", null, 20);

        assertThat(response.query()).isEqualTo("없는값");
        assertThat(response.matchedSubject()).isNull();
        assertThat(response.matchType()).isNull();
        assertThat(response.items()).isEmpty();
        assertThat(response.hasNext()).isFalse();
        verify(searchLogService).recordPostSearch(null, "없는값", null, null);
    }

    private void mockSubjectRows(Map<Integer, String> subjects) throws Exception {
        doAnswer(invocation -> {
            RowCallbackHandler handler = invocation.getArgument(2);
            for (Map.Entry<Integer, String> subject : subjects.entrySet()) {
                ResultSet resultSet = mock(ResultSet.class);
                when(resultSet.getInt("subject_seq")).thenReturn(subject.getKey());
                when(resultSet.getString("subject_name")).thenReturn(subject.getValue());
                handler.processRow(resultSet);
            }
            return null;
        }).when(namedParameterJdbcTemplate).query(
                contains("FROM subjects"),
                any(SqlParameterSource.class),
                any(RowCallbackHandler.class)
        );
    }

    private PostDtos.PostResponse post(Long postSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return new PostDtos.PostResponse(
                postSeq,
                null,
                null,
                0,
                0,
                List.of(),
                false,
                false,
                now,
                now
        );
    }
}
