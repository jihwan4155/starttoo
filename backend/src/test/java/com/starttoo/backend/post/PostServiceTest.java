package com.starttoo.backend.post;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.application.PostService;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostImageRepository;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
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

import java.sql.ResultSet;
import java.time.OffsetDateTime;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock
    private PostRepository postRepository;

    @Mock
    private PostImageRepository postImageRepository;

    @Mock
    private TattooService tattooService;

    @Mock
    private PreferenceScoreService preferenceScoreService;

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
                postService.list(null, 20, null, 7);

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
        when(tattooService.process(
                eq(7),
                anyLong(),
                eq(TattooSourceType.USER_POST)
        )).thenReturn(tattoo(61L))
                .thenThrow(BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));

        assertThatThrownBy(() -> postService.create(
                7,
                new PostDtos.CreatePostRequest(null, List.of(61L, 62L))
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.IMAGE_NOT_FOUND));

        verify(postRepository, never()).save(any());
        verify(postImageRepository, never()).save(any());
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
                when(resultSet.getLong("tattoo_seq")).thenReturn(71L);
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
        OffsetDateTime now = OffsetDateTime.now();
        return Post.builder()
                .postSeq(postSeq)
                .authorSeq(authorSeq)
                .content("content")
                .postStatus(PostStatus.PUBLISHED)
                .likeCount(2)
                .commentCount(1)
                .reportCount(0)
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

    private Tattoo tattoo(Long imageSeq) {
        return Tattoo.builder()
                .tattooSeq(imageSeq + 10)
                .registrantSeq(7)
                .imageSeq(imageSeq)
                .sourceType(TattooSourceType.USER_POST)
                .primaryStyleSeq(1)
                .usedForTraining(false)
                .regDttm(OffsetDateTime.now())
                .modDttm(OffsetDateTime.now())
                .deleted(false)
                .build();
    }
}
