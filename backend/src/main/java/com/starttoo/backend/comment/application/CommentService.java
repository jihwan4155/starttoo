package com.starttoo.backend.comment.application;

import com.starttoo.backend.comment.api.CommentDtos;
import com.starttoo.backend.comment.domain.Comment;
import com.starttoo.backend.comment.domain.CommentRepository;
import com.starttoo.backend.comment.domain.CommentStatus;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.NotificationType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final NotificationService notificationService;
    private final MediaService mediaService;

    @Transactional
    public CommentDtos.CommentResponse create(
            Integer userSeq,
            Long postSeq,
            CommentDtos.CreateCommentRequest request
    ) {
        Post post = postRepository.findByPostSeqAndPostStatus(postSeq, PostStatus.PUBLISHED)
                .filter(value -> !value.isDeleted())
                .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
        if (blocked(userSeq, post.getAuthorSeq())) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
        Comment parent = null;
        if (request.parentCommentSeq() != null) {
            parent = find(request.parentCommentSeq());
            if (!parent.getPostSeq().equals(postSeq)
                    || parent.getCommentStatus() != CommentStatus.PUBLISHED
                    || parent.isDeleted()
                    || parent.getParentCommentSeq() != null) {
                throw BusinessException.of(ErrorCode.INVALID_REQUEST);
            }
            if (blocked(userSeq, parent.getAuthorSeq())) {
                throw BusinessException.of(ErrorCode.COMMENT_NOT_FOUND);
            }
        }
        OffsetDateTime now = OffsetDateTime.now();
        Comment comment = commentRepository.save(Comment.builder()
                .postSeq(postSeq)
                .authorSeq(userSeq)
                .parentCommentSeq(request.parentCommentSeq())
                .content(request.content())
                .likeCount(0)
                .commentStatus(CommentStatus.PUBLISHED)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(userSeq)
                .deleted(false)
                .build());
        postRepository.addCommentCount(postSeq, 1);
        Integer receiverSeq = parent == null ? post.getAuthorSeq() : parent.getAuthorSeq();
        notificationService.create(
                receiverSeq,
                userSeq,
                NotificationType.POST_COMMENT,
                comment.getCommentSeq(),
                request.parentCommentSeq() == null ? "새 댓글" : "새 답글",
                "회원님의 게시물 또는 댓글에 새 내용이 등록되었습니다."
        );
        return response(comment, userSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<CommentDtos.CommentResponse> list(
            Long postSeq,
            Long cursor,
            int size,
            Integer viewerSeq
    ) {
        Post post = postRepository.findByPostSeqAndPostStatus(postSeq, PostStatus.PUBLISHED)
                .filter(value -> !value.isDeleted())
                .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
        if (viewerSeq != null && blocked(viewerSeq, post.getAuthorSeq())) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
        int safeSize = Math.min(Math.max(size, 1), 100);
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT c.comment_seq
                  FROM comments c
                 WHERE c.post_seq = ?
                   AND c.parent_comment_seq IS NULL
                   AND (
                       (
                           c.comment_status = 'PUBLISHED'
                           AND c.is_deleted = FALSE
                       )
                       OR (
                           c.comment_status = 'DELETED'
                           AND c.is_deleted = TRUE
                           AND EXISTS (
                               SELECT 1
                                 FROM comments reply
                                WHERE reply.parent_comment_seq = c.comment_seq
                                  AND reply.comment_status = 'PUBLISHED'
                                  AND reply.is_deleted = FALSE
                           )
                       )
                   )
                   AND (CAST(? AS BIGINT) IS NULL OR c.comment_seq > ?)
                   AND (
                       CAST(? AS INTEGER) IS NULL OR NOT EXISTS (
                            SELECT 1
                              FROM user_blocks user_block
                             WHERE (
                                 user_block.blocker_seq = ?
                                 AND user_block.blocked_seq = c.author_seq
                             )
                                OR (
                                 user_block.blocker_seq = c.author_seq
                                 AND user_block.blocked_seq = ?
                             )
                        )
                   )
                 ORDER BY c.comment_seq
                 LIMIT ?
                """, Long.class,
                postSeq,
                cursor, cursor,
                viewerSeq, viewerSeq, viewerSeq,
                safeSize + 1
        );
        return page(ids, safeSize, viewerSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<CommentDtos.CommentResponse> replies(
            Long parentCommentSeq,
            Long cursor,
            int size,
            Integer viewerSeq
    ) {
        Comment parent = find(parentCommentSeq);
        if (parent.getParentCommentSeq() != null) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        if (parent.getCommentStatus() == CommentStatus.HIDDEN) {
            throw BusinessException.of(ErrorCode.COMMENT_NOT_FOUND);
        }
        Post post = postRepository
                .findByPostSeqAndPostStatus(parent.getPostSeq(), PostStatus.PUBLISHED)
                .filter(value -> !value.isDeleted())
                .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
        if (viewerSeq != null && (
                blocked(viewerSeq, post.getAuthorSeq())
                        || blocked(viewerSeq, parent.getAuthorSeq())
        )) {
            throw BusinessException.of(ErrorCode.COMMENT_NOT_FOUND);
        }

        int safeSize = Math.min(Math.max(size, 1), 100);
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT c.comment_seq
                  FROM comments c
                 WHERE c.post_seq = ?
                   AND c.parent_comment_seq = ?
                   AND c.comment_status = 'PUBLISHED'
                   AND c.is_deleted = FALSE
                   AND (CAST(? AS BIGINT) IS NULL OR c.comment_seq > ?)
                   AND (
                       CAST(? AS INTEGER) IS NULL OR NOT EXISTS (
                           SELECT 1
                             FROM user_blocks user_block
                            WHERE (
                                user_block.blocker_seq = ?
                                AND user_block.blocked_seq = c.author_seq
                            )
                               OR (
                                user_block.blocker_seq = c.author_seq
                                AND user_block.blocked_seq = ?
                            )
                       )
                   )
                 ORDER BY c.comment_seq
                 LIMIT ?
                """, Long.class,
                parent.getPostSeq(),
                parentCommentSeq,
                cursor, cursor,
                viewerSeq, viewerSeq, viewerSeq,
                safeSize + 1
        );
        return page(ids, safeSize, viewerSeq);
    }

    @Transactional
    public CommentDtos.CommentResponse update(
            Integer userSeq,
            Long commentSeq,
            CommentDtos.UpdateCommentRequest request
    ) {
        Comment comment = owned(commentSeq, userSeq);
        comment.update(request.content(), userSeq);
        return response(comment, userSeq);
    }

    @Transactional
    public void delete(Integer userSeq, Long commentSeq) {
        Comment comment = find(commentSeq);
        if (!comment.getAuthorSeq().equals(userSeq)) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        if (comment.isDeleted()) {
            return;
        }
        int changed = commentRepository.softDelete(
                commentSeq,
                userSeq,
                userSeq,
                OffsetDateTime.now()
        );
        if (changed > 0) {
            postRepository.addCommentCount(comment.getPostSeq(), -1);
        }
    }

    @Transactional
    public boolean setLike(Integer userSeq, Long commentSeq, boolean enabled) {
        Comment comment = find(commentSeq);
        if (comment.getCommentStatus() != CommentStatus.PUBLISHED || comment.isDeleted()) {
            throw BusinessException.of(ErrorCode.COMMENT_NOT_FOUND);
        }
        Post post = postRepository
                .findByPostSeqAndPostStatus(comment.getPostSeq(), PostStatus.PUBLISHED)
                .filter(value -> !value.isDeleted())
                .orElseThrow(() -> BusinessException.of(ErrorCode.COMMENT_NOT_FOUND));
        if (blocked(userSeq, post.getAuthorSeq())
                || blocked(userSeq, comment.getAuthorSeq())) {
            throw BusinessException.of(ErrorCode.COMMENT_NOT_FOUND);
        }
        int changed;
        if (enabled) {
            changed = jdbcTemplate.update("""
                    INSERT INTO comment_likes (comment_seq, user_seq)
                    VALUES (?, ?)
                    ON CONFLICT DO NOTHING
                    """, commentSeq, userSeq);
            if (changed > 0) {
                commentRepository.addLikeCount(commentSeq, 1);
                notificationService.create(
                        comment.getAuthorSeq(),
                        userSeq,
                        NotificationType.COMMENT_LIKE,
                        commentSeq,
                        "댓글 좋아요",
                        "회원님의 댓글에 좋아요가 추가되었습니다."
                );
            }
            return true;
        }
        changed = jdbcTemplate.update(
                "DELETE FROM comment_likes WHERE comment_seq = ? AND user_seq = ?",
                commentSeq,
                userSeq
        );
        if (changed > 0) {
            commentRepository.addLikeCount(commentSeq, -1);
        }
        return false;
    }

    private CommentDtos.CommentResponse response(Comment comment, Integer viewerSeq) {
        return responses(List.of(comment), viewerSeq).get(0);
    }

    private CursorPageResponse<CommentDtos.CommentResponse> page(
            List<Long> ids,
            int size,
            Integer viewerSeq
    ) {
        boolean hasNext = ids.size() > size;
        List<Long> page = hasNext ? ids.subList(0, size) : ids;
        Map<Long, Comment> byId = new HashMap<>();
        commentRepository.findAllById(page)
                .forEach(value -> byId.put(value.getCommentSeq(), value));
        List<Comment> comments = page.stream()
                .map(id -> Objects.requireNonNull(byId.get(id)))
                .toList();
        List<CommentDtos.CommentResponse> items = responses(comments, viewerSeq);
        String next = hasNext ? page.get(page.size() - 1).toString() : null;
        return CursorPageResponse.of(items, next, hasNext);
    }

    private List<CommentDtos.CommentResponse> responses(
            List<Comment> comments,
            Integer viewerSeq
    ) {
        if (comments.isEmpty()) {
            return List.of();
        }
        Set<Integer> authorSeqs = comments.stream()
                .filter(comment -> !comment.isDeleted())
                .map(Comment::getAuthorSeq)
                .collect(java.util.stream.Collectors.toSet());
        Map<Integer, CommentDtos.CommentAuthor> authors = authors(authorSeqs);

        List<Long> visibleCommentSeqs = comments.stream()
                .filter(comment -> !comment.isDeleted())
                .map(Comment::getCommentSeq)
                .toList();
        Set<Long> liked = viewerSeq == null || visibleCommentSeqs.isEmpty()
                ? Set.of()
                : new HashSet<>(namedParameterJdbcTemplate.queryForList("""
                        SELECT comment_seq
                          FROM comment_likes
                         WHERE user_seq = :userSeq
                            AND comment_seq IN (:commentSeqs)
                        """, new MapSqlParameterSource()
                        .addValue("userSeq", viewerSeq)
                        .addValue("commentSeqs", visibleCommentSeqs), Long.class));
        Map<Long, Integer> replyCounts = replyCounts(comments);

        return comments.stream().map(comment -> {
            boolean deleted = comment.isDeleted()
                    || comment.getCommentStatus() == CommentStatus.DELETED;
            return new CommentDtos.CommentResponse(
                    comment.getCommentSeq(),
                    comment.getPostSeq(),
                    deleted ? null : authors.get(comment.getAuthorSeq()),
                    comment.getParentCommentSeq(),
                    deleted ? null : comment.getContent(),
                    deleted ? 0 : comment.getLikeCount(),
                    comment.getParentCommentSeq() == null
                            ? replyCounts.getOrDefault(comment.getCommentSeq(), 0)
                            : 0,
                    !deleted && liked.contains(comment.getCommentSeq()),
                    deleted,
                    comment.getRegDttm(),
                    comment.getModDttm()
            );
        }).toList();
    }

    private Map<Integer, CommentDtos.CommentAuthor> authors(Set<Integer> authorSeqs) {
        if (authorSeqs.isEmpty()) {
            return Map.of();
        }
        List<AuthorRow> rows = namedParameterJdbcTemplate.query("""
                SELECT u.user_seq,
                       u.nickname,
                       u.profile_image_seq,
                       i.object_key AS profile_object_key
                  FROM users u
                  LEFT JOIN images i
                    ON i.image_seq = u.profile_image_seq
                   AND i.is_deleted = FALSE
                 WHERE u.user_seq IN (:authorSeqs)
                """, new MapSqlParameterSource("authorSeqs", authorSeqs), (rs, rowNum) ->
                new AuthorRow(
                        rs.getInt("user_seq"),
                        rs.getString("nickname"),
                        rs.getObject("profile_image_seq", Long.class),
                        rs.getString("profile_object_key")
                ));
        Map<Integer, CommentDtos.CommentAuthor> authors = new HashMap<>();
        for (AuthorRow row : rows) {
            authors.put(row.userSeq(), new CommentDtos.CommentAuthor(
                    row.userSeq(),
                    row.nickname(),
                    row.profileImageSeq(),
                    row.profileObjectKey() == null
                            ? null
                            : mediaService.downloadUrl(row.profileObjectKey())
            ));
        }
        return authors;
    }

    private Map<Long, Integer> replyCounts(List<Comment> comments) {
        List<Long> topLevelSeqs = comments.stream()
                .filter(comment -> comment.getParentCommentSeq() == null)
                .map(Comment::getCommentSeq)
                .toList();
        if (topLevelSeqs.isEmpty()) {
            return Map.of();
        }
        List<ReplyCountRow> rows = namedParameterJdbcTemplate.query("""
                SELECT parent_comment_seq, COUNT(*) AS reply_count
                  FROM comments
                 WHERE parent_comment_seq IN (:commentSeqs)
                   AND comment_status = 'PUBLISHED'
                   AND is_deleted = FALSE
                 GROUP BY parent_comment_seq
                """, new MapSqlParameterSource("commentSeqs", topLevelSeqs), (rs, rowNum) ->
                new ReplyCountRow(
                        rs.getLong("parent_comment_seq"),
                        rs.getInt("reply_count")
                ));
        Map<Long, Integer> counts = new HashMap<>();
        rows.forEach(row -> counts.put(row.commentSeq(), row.replyCount()));
        return counts;
    }

    private Comment find(Long commentSeq) {
        return commentRepository.findById(commentSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.COMMENT_NOT_FOUND));
    }

    private Comment owned(Long commentSeq, Integer userSeq) {
        Comment comment = find(commentSeq);
        if (!comment.getAuthorSeq().equals(userSeq)) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        if (comment.isDeleted()) {
            throw BusinessException.of(ErrorCode.COMMENT_NOT_FOUND);
        }
        return comment;
    }

    private boolean blocked(Integer viewerSeq, Integer authorSeq) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM user_blocks
                     WHERE (blocker_seq = ? AND blocked_seq = ?)
                        OR (blocker_seq = ? AND blocked_seq = ?)
                )
                """, Boolean.class, viewerSeq, authorSeq, authorSeq, viewerSeq));
    }

    private record AuthorRow(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            String profileObjectKey
    ) {
    }

    private record ReplyCountRow(Long commentSeq, int replyCount) {
    }
}
