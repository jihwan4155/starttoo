package com.starttoo.backend.post;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.application.PostTattooClassificationService;
import com.starttoo.backend.post.application.PostService;
import com.starttoo.backend.post.application.PostWriteService;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.preference.config.PreferenceProperties;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock
    private PostRepository postRepository;

    @Mock
    private TattooService tattooService;

    @Mock
    private PostTattooClassificationService postTattooClassificationService;

    @Mock
    private PostWriteService postWriteService;

    @Mock
    private PreferenceScoreService preferenceScoreService;

    @Mock
    private PreferenceProperties preferenceProperties;

    @Mock
    private UserService userService;

    @Mock
    private MediaService mediaService;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private PostService postService;

    @Test
    void listFiltersPublishedActiveAuthorsBlocksAndHiddenPreferences() {
        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                any(Object[].class)
        )).thenReturn(List.of());
        when(postRepository.findAllById(any())).thenReturn(List.of());

        CursorPageResponse<PostDtos.PostResponse> page =
                postService.list((String) null, 20, null, null);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForList(
                sql.capture(),
                eq(Long.class),
                any(Object[].class)
        );
        assertThat(sql.getValue()).contains(
                "p.post_status = 'PUBLISHED'",
                "p.is_deleted = FALSE",
                "author.account_status = 'ACTIVE'",
                "user_blocks",
                "post_hidden_preferences",
                "ORDER BY p.post_seq DESC"
        );
        assertThat(page.items()).isEmpty();
    }

    @Test
    void loggedInFeedBlendsPreferenceScoreWithRecency() {
        when(preferenceProperties.feedPreferenceWeight()).thenReturn(24.0);
        when(preferenceProperties.feedRecencyPerHour()).thenReturn(0.2);
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenReturn(List.of());

        CursorPageResponse<PostDtos.PostResponse> page =
                postService.list((String) null, 20, null, 7);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(
                sql.capture(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
        assertThat(sql.getValue()).contains(
                "user_primary_style_preferences",
                "user_color_preferences",
                "ARRAY_AGG",
                "matched_image_seq",
                "image_pref.score DESC",
                "EXTRACT(EPOCH FROM p.reg_dttm)",
                "p.author_seq <> ?",
                "user_blocks",
                "post_hidden_preferences",
                "ORDER BY ranked.blend_score DESC, ranked.post_seq DESC"
        );
        assertThat(page.items()).isEmpty();
    }

    @Test
    void loggedInFeedNormalizesPreferenceScoreByAxisTotal() throws Exception {
        when(preferenceProperties.feedPreferenceWeight()).thenReturn(24.0);
        when(preferenceProperties.feedRecencyPerHour()).thenReturn(0.2);
        ResultSet totals = mock(ResultSet.class);
        when(totals.getBigDecimal("style_total")).thenReturn(new BigDecimal("40"));
        when(totals.getBigDecimal("color_total")).thenReturn(new BigDecimal("10"));
        when(jdbcTemplate.queryForObject(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenAnswer(invocation -> invocation
                .<RowMapper<Object>>getArgument(1)
                .mapRow(totals, 0));
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenReturn(List.of());

        postService.list((String) null, 20, null, 7);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> params = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).query(
                sql.capture(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                params.capture()
        );
        // 이미지 점수를 합하면 사진을 많이 붙인 게시물이 점유율 상한을 장수만큼 뚫는다.
        assertThat(sql.getValue())
                .contains("MAX(image_pref.score) AS score")
                .doesNotContain("SUM(image_pref.score)");
        // 가중치·최신성 다음 두 자리가 스타일·색상 축의 분모다.
        assertThat(params.getValue()[2]).isEqualTo(new BigDecimal("40"));
        assertThat(params.getValue()[3]).isEqualTo(new BigDecimal("10"));
    }

    @Test
    void loggedInFeedFallsBackToOneWhenPreferenceTotalIsZero() {
        when(preferenceProperties.feedPreferenceWeight()).thenReturn(24.0);
        when(preferenceProperties.feedRecencyPerHour()).thenReturn(0.2);
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenReturn(List.of());

        postService.list((String) null, 20, null, 7);

        ArgumentCaptor<Object[]> params = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                params.capture()
        );
        // 취향이 아직 없는 회원은 0으로 나누면 안 된다. 분자도 0이라 결과는 0이 된다.
        assertThat(params.getValue()[2]).isEqualTo(BigDecimal.ONE);
        assertThat(params.getValue()[3]).isEqualTo(BigDecimal.ONE);
    }

    @Test
    void feedCursorCarriesAxisTotalsSoNextPageKeepsSameDenominator() {
        when(preferenceProperties.feedPreferenceWeight()).thenReturn(24.0);
        when(preferenceProperties.feedRecencyPerHour()).thenReturn(0.2);
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenReturn(List.of());

        String cursor = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "12.5000|31|40|10".getBytes(StandardCharsets.UTF_8)
        );
        postService.list(cursor, 20, null, 7);

        ArgumentCaptor<Object[]> params = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                params.capture()
        );
        // 커서에 총합이 실려 있으면 다시 조회하지 않는다. 페이지를 넘기는 도중
        // 좋아요를 눌러도 분모가 그대로여서 이미 본 게시물의 순위가 흔들리지 않는다.
        verify(jdbcTemplate, never()).queryForObject(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
        assertThat(params.getValue()[2]).isEqualTo(new BigDecimal("40"));
        assertThat(params.getValue()[3]).isEqualTo(new BigDecimal("10"));
    }

    @Test
    void feedCursorIssuedBeforeAxisTotalsStillWorks() {
        when(preferenceProperties.feedPreferenceWeight()).thenReturn(24.0);
        when(preferenceProperties.feedRecencyPerHour()).thenReturn(0.2);
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenReturn(List.of());

        String legacy = Base64.getUrlEncoder().withoutPadding().encodeToString(
                "12.5000|31".getBytes(StandardCharsets.UTF_8)
        );

        // 배포 직후 화면에 남아 있던 두 칸짜리 커서도 오류 없이 이어져야 한다.
        assertThat(postService.list(legacy, 20, null, 7).items()).isEmpty();
        verify(jdbcTemplate).queryForObject(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
    }

    @Test
    void primaryStyleFilterUsesMatchingImageWithoutPersonalization() {
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenReturn(List.of());

        CursorPageResponse<PostDtos.PostResponse> page =
                postService.list(null, 20, null, "minimal", 7);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(
                sql.capture(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
        assertThat(sql.getValue()).contains(
                "DISTINCT ON (p.post_seq)",
                "JOIN primary_styles style",
                "style.style_code = ?",
                "pi.image_seq AS matched_image_seq",
                "ORDER BY p.post_seq DESC, pi.display_order"
        ).doesNotContain(
                "user_primary_style_preferences",
                "user_color_preferences"
        );
        assertThat(page.items()).isEmpty();
    }

    @Test
    void authorFilteredListKeepsChronologicalOrderForLoggedInViewer() {
        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                any(Object[].class)
        )).thenReturn(List.of());
        when(postRepository.findAllById(any())).thenReturn(List.of());

        postService.list("31", 20, 5, 7);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForList(
                sql.capture(),
                eq(Long.class),
                any(Object[].class)
        );
        assertThat(sql.getValue()).contains("ORDER BY p.post_seq DESC");
    }

    @Test
    void invalidFeedCursorIsRejected() {
        assertThatThrownBy(() -> postService.list("not-a-cursor!!", 20, 5, 7))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.INVALID_CURSOR));
    }

    @Test
    void bookmarkedUsesBookmarkTimeAndPostSequenceCursor() {
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        )).thenReturn(List.of());

        CursorPageResponse<PostDtos.PostResponse> page =
                postService.bookmarked(7, null, 20);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(
                sql.capture(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
        assertThat(sql.getValue()).contains(
                "bookmark.user_seq = ?",
                "ORDER BY bookmark.reg_dttm DESC, p.post_seq DESC"
        );
        assertThat(page.items()).isEmpty();
    }

    @Test
    void responsePresignsAuthorProfileAndPostImageObjectKeys() throws Exception {
        Post post = post(31L, 8);
        when(postRepository.findByPostSeqAndPostStatus(31L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post));
        when(userService.find(8)).thenReturn(activeUser(8));
        when(mediaService.downloadUrl("users/8/profile.webp"))
                .thenReturn("https://minio.example/profile");
        when(mediaService.downloadUrl("users/8/post.webp"))
                .thenReturn("https://minio.example/post");
        mockPostResponseRows();

        PostDtos.PostResponse response = postService.get(31L, null);

        assertThat(response.author().userSeq()).isEqualTo(8);
        assertThat(response.author().profileImageSeq()).isEqualTo(51L);
        assertThat(response.author().profileImageUrl())
                .isEqualTo("https://minio.example/profile");
        assertThat(response.images()).singleElement().satisfies(image -> {
            assertThat(image.imageSeq()).isEqualTo(61L);
            assertThat(image.imageUrl()).isEqualTo("https://minio.example/post");
            assertThat(image.tattooSeq()).isEqualTo(71L);
        });
    }

    @Test
    void createDoesNotSavePostWhenAnyImageProcessingFails() {
        when(userService.find(7)).thenReturn(activeUser(7));
        when(tattooService.preparePostImage(7, 61L))
                .thenReturn(new TattooService.PreparedPostImage(61L, "object-61"));
        when(tattooService.preparePostImage(7, 62L))
                .thenThrow(BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));

        assertThatThrownBy(() -> postService.create(
                7,
                new PostDtos.CreatePostRequest(null, List.of(61L, 62L))
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.IMAGE_NOT_FOUND));

        verify(postWriteService, never()).create(any(), any(), any());
    }

    @Test
    void updateUsesPartialUpdateAndReturnsFreshCounts() throws Exception {
        Post original = post(31L, 8);
        Post refreshed = post(31L, 8, "updated", 7, 4, 2);
        when(postRepository.findByPostSeq(31L))
                .thenReturn(Optional.of(original), Optional.of(refreshed));
        when(postRepository.updateContent(
                eq(31L),
                eq(8),
                eq("updated"),
                eq(8),
                any(OffsetDateTime.class)
        )).thenReturn(1);
        mockPostResponseRows();

        PostDtos.PostResponse response = postService.update(
                8,
                31L,
                new PostDtos.UpdatePostRequest("updated")
        );

        assertThat(response.content()).isEqualTo("updated");
        assertThat(response.likeCount()).isEqualTo(7);
        assertThat(response.commentCount()).isEqualTo(4);
        verify(postRepository).updateContent(
                eq(31L),
                eq(8),
                eq("updated"),
                eq(8),
                any(OffsetDateTime.class)
        );
    }

    @Test
    void deleteUsesPartialSoftDelete() {
        when(postRepository.findByPostSeq(31L))
                .thenReturn(Optional.of(post(31L, 8)));
        when(postRepository.softDelete(
                eq(31L),
                eq(8),
                eq(8),
                any(OffsetDateTime.class)
        )).thenReturn(1);

        postService.delete(8, 31L);

        verify(postRepository).softDelete(
                eq(31L),
                eq(8),
                eq(8),
                any(OffsetDateTime.class)
        );
    }

    @Test
    void repeatedLikeDoesNotChangeCountScoreOrNotification() {
        when(postRepository.findByPostSeqAndPostStatus(31L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post(31L, 8)));
        when(jdbcTemplate.update(
                contains("INSERT INTO post_likes"),
                eq(31L),
                eq(7)
        )).thenReturn(0);

        assertThat(postService.setLike(7, 31L, true)).isTrue();

        verify(postRepository, never()).addLikeCount(anyLong(), anyInt());
        verify(preferenceScoreService, never()).applyPostLike(any(), any(), anyBoolean());
        verify(notificationService, never()).create(
                any(), any(), any(), any(), any(), any()
        );
    }

    @Test
    void reportHidesPostAndAppliesNotInterestedScore() {
        when(postRepository.findByPostSeqAndPostStatus(31L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post(31L, 8)));
        when(jdbcTemplate.queryForObject(
                contains("SELECT EXISTS"),
                eq(Boolean.class),
                eq(7), eq(8), eq(8), eq(7)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("INSERT INTO post_reports"),
                eq(Long.class),
                eq(31L),
                eq(7),
                eq("INAPPROPRIATE"),
                isNull(),
                eq(7)
        )).thenReturn(99L);
        when(jdbcTemplate.update(
                contains("INSERT INTO post_hidden_preferences"),
                eq(31L),
                eq(7)
        )).thenReturn(1);

        PostDtos.ReportResponse response = postService.report(
                7,
                31L,
                new PostDtos.ReportRequest("INAPPROPRIATE", null)
        );

        assertThat(response.reportSeq()).isEqualTo(99L);
        assertThat(response.reportStatus()).isEqualTo(PostDtos.ReportStatus.PENDING);
        verify(postRepository).addReportCount(31L, 1);
        verify(preferenceScoreService).applyNotInterested(7, 31L, true);
    }

    @Test
    void duplicateReportReturnsConflictWithoutIncreasingCount() {
        when(postRepository.findByPostSeqAndPostStatus(31L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post(31L, 8)));
        when(jdbcTemplate.queryForObject(
                contains("SELECT EXISTS"),
                eq(Boolean.class),
                eq(7), eq(8), eq(8), eq(7)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("INSERT INTO post_reports"),
                eq(Long.class),
                eq(31L),
                eq(7),
                eq("INAPPROPRIATE"),
                isNull(),
                eq(7)
        )).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> postService.report(
                7,
                31L,
                new PostDtos.ReportRequest("INAPPROPRIATE", null)
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getErrorCode())
                        .isEqualTo(ErrorCode.DUPLICATE_RESOURCE));

        verify(postRepository, never()).addReportCount(anyLong(), anyInt());
    }

    private void mockPostResponseRows() throws Exception {
        doAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            RowCallbackHandler handler = invocation.getArgument(2);
            ResultSet resultSet = org.mockito.Mockito.mock(ResultSet.class);
            if (sql.contains("FROM users author")) {
                when(resultSet.getInt("user_seq")).thenReturn(8);
                when(resultSet.getString("nickname")).thenReturn("artist");
                when(resultSet.getString("role")).thenReturn("ARTIST");
                when(resultSet.getObject("profile_image_seq", Long.class)).thenReturn(51L);
                when(resultSet.getString("profile_object_key"))
                        .thenReturn("users/8/profile.webp");
            } else {
                when(resultSet.getLong("post_seq")).thenReturn(31L);
                when(resultSet.getLong("post_image_seq")).thenReturn(41L);
                when(resultSet.getLong("image_seq")).thenReturn(61L);
                when(resultSet.getString("image_object_key"))
                        .thenReturn("users/8/post.webp");
                when(resultSet.getObject("tattoo_seq", Long.class)).thenReturn(71L);
                when(resultSet.getShort("display_order")).thenReturn((short) 1);
            }
            handler.processRow(resultSet);
            return null;
        }).when(namedParameterJdbcTemplate).query(
                anyString(),
                any(SqlParameterSource.class),
                any(RowCallbackHandler.class)
        );
    }

    private Post post(Long postSeq, Integer authorSeq) {
        return post(postSeq, authorSeq, "content", 2, 1, 0);
    }

    private Post post(
            Long postSeq,
            Integer authorSeq,
            String content,
            int likeCount,
            int commentCount,
            int reportCount
    ) {
        OffsetDateTime now = OffsetDateTime.now();
        return Post.builder()
                .postSeq(postSeq)
                .authorSeq(authorSeq)
                .content(content)
                .postStatus(PostStatus.PUBLISHED)
                .likeCount(likeCount)
                .commentCount(commentCount)
                .reportCount(reportCount)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(authorSeq)
                .deleted(false)
                .build();
    }

    private User activeUser(Integer userSeq) {
        return User.builder()
                .userSeq(userSeq)
                .nickname("artist")
                .role(UserRole.ARTIST)
                .profileImageSeq(51L)
                .accountStatus(AccountStatus.ACTIVE)
                .deleted(false)
                .build();
    }

}
