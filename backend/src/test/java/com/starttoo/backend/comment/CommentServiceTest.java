package com.starttoo.backend.comment;

import com.starttoo.backend.comment.api.CommentDtos;
import com.starttoo.backend.comment.application.CommentService;
import com.starttoo.backend.comment.domain.Comment;
import com.starttoo.backend.comment.domain.CommentRepository;
import com.starttoo.backend.comment.domain.CommentStatus;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.NotificationType;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.mockito.InOrder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommentServiceTest {

    private CommentRepository commentRepository;
    private PostRepository postRepository;
    private JdbcTemplate jdbcTemplate;
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private NotificationService notificationService;
    private MediaService mediaService;
    private CommentService commentService;
    private List<Long> queryIds;
    private List<String> queriedSql;

    @BeforeEach
    void setUp() {
        commentRepository = mock(CommentRepository.class);
        postRepository = mock(PostRepository.class);
        queryIds = List.of();
        queriedSql = new ArrayList<>();
        jdbcTemplate = mock(JdbcTemplate.class, invocation -> {
            if ("queryForList".equals(invocation.getMethod().getName())) {
                queriedSql.add(invocation.getArgument(0));
                return queryIds;
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        namedParameterJdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        notificationService = mock(NotificationService.class);
        mediaService = mock(MediaService.class);
        commentService = new CommentService(
                commentRepository,
                postRepository,
                jdbcTemplate,
                namedParameterJdbcTemplate,
                notificationService,
                mediaService
        );
    }

    @Test
    void topLevelListExcludesRepliesAndKeepsEligibleTombstones() {
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));

        commentService.list(100L, null, 30, null);

        assertThat(queriedSql).singleElement().satisfies(sql ->
                assertThat(sql)
                        .contains("c.parent_comment_seq IS NULL")
                        .contains("reply.parent_comment_seq = c.comment_seq")
                        .contains("c.comment_status = 'DELETED'"));
    }

    @Test
    void replyListQueriesOnlyTheSpecifiedParent() {
        Comment parent = comment(501L, 100L, 7, null, false);
        when(commentRepository.findById(501L)).thenReturn(Optional.of(parent));
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));

        commentService.replies(501L, null, 30, null);

        assertThat(queriedSql).singleElement().satisfies(sql ->
                assertThat(sql)
                        .contains("c.parent_comment_seq = ?")
                        .contains("c.comment_status = 'PUBLISHED'")
                        .contains("c.is_deleted = FALSE"));
    }

    @Test
    void rejectsReplyToReply() {
        Comment reply = comment(502L, 100L, 8, 501L, false);
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));
        when(commentRepository.findById(502L)).thenReturn(Optional.of(reply));

        assertError(
                () -> commentService.create(
                        9,
                        100L,
                        new CommentDtos.CreateCommentRequest(502L, "답글의 답글")
                ),
                ErrorCode.INVALID_REQUEST
        );

        verify(commentRepository, never()).save(any(Comment.class));
        verify(postRepository, never()).addCommentCount(any(), any(Integer.class));
    }

    @Test
    void rejectsParentFromAnotherPost() {
        Comment parent = comment(501L, 200L, 8, null, false);
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));
        when(commentRepository.findById(501L)).thenReturn(Optional.of(parent));

        assertError(
                () -> commentService.create(
                        9,
                        100L,
                        new CommentDtos.CreateCommentRequest(501L, "잘못된 부모")
                ),
                ErrorCode.INVALID_REQUEST
        );

        verify(commentRepository, never()).save(any(Comment.class));
    }

    @Test
    void deletedTopLevelCommentBecomesTombstoneAndKeepsReplyCount() throws Exception {
        queryIds = List.of(501L);
        Comment tombstone = comment(501L, 100L, 7, null, true);
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));
        when(commentRepository.findAllById(List.of(501L)))
                .thenReturn(List.of(tombstone));
        stubReplyCount(501L, 2);

        CommentDtos.CommentResponse response =
                commentService.list(100L, null, 30, null).items().get(0);

        assertThat(response.deleted()).isTrue();
        assertThat(response.author()).isNull();
        assertThat(response.content()).isNull();
        assertThat(response.replyCount()).isEqualTo(2);
        assertThat(response.likeCount()).isZero();
    }

    @Test
    void authorProfileImageUsesPresignedUrlFromObjectKey() throws Exception {
        Comment saved = comment(501L, 100L, 9, null, false);
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));
        when(commentRepository.save(any(Comment.class))).thenReturn(saved);
        stubAuthor(9, 301L, "profiles/9/avatar.png");
        when(mediaService.downloadUrl("profiles/9/avatar.png"))
                .thenReturn("https://temporary-download-url");

        CommentDtos.CommentResponse response = commentService.create(
                9,
                100L,
                new CommentDtos.CreateCommentRequest(null, "좋은 작업입니다.")
        );

        assertThat(response.author().profileImageSeq()).isEqualTo(301L);
        assertThat(response.author().profileImageUrl())
                .isEqualTo("https://temporary-download-url");
        verify(mediaService).downloadUrl("profiles/9/avatar.png");
    }

    @Test
    void repeatedDeleteDecrementsPostCountOnlyOnce() {
        Comment comment = comment(501L, 100L, 9, null, false);
        when(commentRepository.findById(501L)).thenReturn(Optional.of(comment));
        when(commentRepository.softDelete(
                eq(501L), eq(9), eq(9), any(OffsetDateTime.class)
        )).thenReturn(1, 0);

        commentService.delete(9, 501L);
        commentService.delete(9, 501L);

        verify(commentRepository, org.mockito.Mockito.times(2)).softDelete(
                eq(501L), eq(9), eq(9), any(OffsetDateTime.class)
        );
        verify(postRepository).addCommentCount(100L, -1);
    }

    @Test
    void repeatedLikeChangesCountAndNotificationOnlyOnce() {
        Comment comment = comment(501L, 100L, 7, null, false);
        when(commentRepository.findById(501L)).thenReturn(Optional.of(comment));
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));
        when(jdbcTemplate.update(anyString(), eq(501L), eq(9)))
                .thenReturn(1, 0);

        assertThat(commentService.setLike(9, 501L, true)).isTrue();
        assertThat(commentService.setLike(9, 501L, true)).isTrue();

        verify(commentRepository).addLikeCount(501L, 1);
        verify(notificationService).create(
                7,
                9,
                NotificationType.COMMENT_LIKE,
                501L,
                "댓글 좋아요",
                "회원님의 댓글에 좋아요가 추가되었습니다."
        );
    }

    @Test
    void notificationFailurePropagatesAfterCommentAndCountWrites() {
        Comment saved = comment(501L, 100L, 9, null, false);
        when(postRepository.findByPostSeqAndPostStatus(100L, PostStatus.PUBLISHED))
                .thenReturn(Optional.of(post()));
        when(commentRepository.save(any(Comment.class))).thenReturn(saved);
        when(notificationService.create(
                any(), any(), any(), any(), anyString(), anyString()
        )).thenThrow(new IllegalStateException("notification insert failed"));

        assertThatThrownBy(() -> commentService.create(
                9,
                100L,
                new CommentDtos.CreateCommentRequest(null, "댓글")
        )).isInstanceOf(IllegalStateException.class);

        InOrder order = inOrder(commentRepository, postRepository, notificationService);
        order.verify(commentRepository).save(any(Comment.class));
        order.verify(postRepository).addCommentCount(100L, 1);
        order.verify(notificationService).create(
                eq(7), eq(9), eq(NotificationType.POST_COMMENT),
                eq(501L), anyString(), anyString()
        );
    }

    @SuppressWarnings("unchecked")
    private void stubAuthor(
            Integer userSeq,
            Long profileImageSeq,
            String objectKey
    ) throws Exception {
        when(namedParameterJdbcTemplate.query(
                contains("FROM users u"),
                any(SqlParameterSource.class),
                any(RowMapper.class)
        )).thenAnswer(invocation -> {
            RowMapper<Object> mapper = invocation.getArgument(2);
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getInt("user_seq")).thenReturn(userSeq);
            when(resultSet.getString("nickname")).thenReturn("작성자");
            when(resultSet.getObject("profile_image_seq", Long.class))
                    .thenReturn(profileImageSeq);
            when(resultSet.getString("profile_object_key")).thenReturn(objectKey);
            return List.of(mapper.mapRow(resultSet, 0));
        });
    }

    @SuppressWarnings("unchecked")
    private void stubReplyCount(Long commentSeq, int replyCount) throws Exception {
        when(namedParameterJdbcTemplate.query(
                contains("COUNT(*) AS reply_count"),
                any(SqlParameterSource.class),
                any(RowMapper.class)
        )).thenAnswer(invocation -> {
            RowMapper<Object> mapper = invocation.getArgument(2);
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getLong("parent_comment_seq")).thenReturn(commentSeq);
            when(resultSet.getInt("reply_count")).thenReturn(replyCount);
            return List.of(mapper.mapRow(resultSet, 0));
        });
    }

    private void assertError(Runnable invocation, ErrorCode errorCode) {
        assertThatThrownBy(invocation::run)
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    private Post post() {
        OffsetDateTime now = OffsetDateTime.now();
        return Post.builder()
                .postSeq(100L)
                .authorSeq(7)
                .postStatus(PostStatus.PUBLISHED)
                .likeCount(0)
                .commentCount(0)
                .reportCount(0)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(7)
                .deleted(false)
                .build();
    }

    private Comment comment(
            Long commentSeq,
            Long postSeq,
            Integer authorSeq,
            Long parentCommentSeq,
            boolean deleted
    ) {
        OffsetDateTime now = OffsetDateTime.now();
        return Comment.builder()
                .commentSeq(commentSeq)
                .postSeq(postSeq)
                .authorSeq(authorSeq)
                .parentCommentSeq(parentCommentSeq)
                .content("댓글 내용")
                .likeCount(3)
                .commentStatus(deleted ? CommentStatus.DELETED : CommentStatus.PUBLISHED)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(authorSeq)
                .deleted(deleted)
                .build();
    }
}
