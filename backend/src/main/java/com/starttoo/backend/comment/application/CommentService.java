package com.starttoo.backend.comment.application;

import com.starttoo.backend.comment.api.CommentDtos;
import com.starttoo.backend.comment.domain.Comment;
import com.starttoo.backend.comment.domain.CommentRepository;
import com.starttoo.backend.comment.domain.CommentStatus;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
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
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final NotificationService notificationService;

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
                SELECT comment_seq
                  FROM comments
                 WHERE post_seq = ?
                   AND comment_status = 'PUBLISHED'
                   AND is_deleted = FALSE
                   AND (CAST(? AS BIGINT) IS NULL OR comment_seq > ?)
                   AND (
                       CAST(? AS INTEGER) IS NULL OR NOT EXISTS (
                           SELECT 1
                             FROM user_blocks user_block
                            WHERE (
                                user_block.blocker_seq = ?
                                AND user_block.blocked_seq = comments.author_seq
                            )
                               OR (
                                user_block.blocker_seq = comments.author_seq
                                AND user_block.blocked_seq = ?
                            )
                       )
                   )
                 ORDER BY comment_seq
                 LIMIT ?
                """, Long.class,
                postSeq,
                cursor, cursor,
                viewerSeq, viewerSeq, viewerSeq,
                safeSize + 1
        );
        boolean hasNext = ids.size() > safeSize;
        List<Long> page = hasNext ? ids.subList(0, safeSize) : ids;
        Map<Long, Comment> byId = new HashMap<>();
        commentRepository.findAllById(page)
                .forEach(value -> byId.put(value.getCommentSeq(), value));
        List<Comment> comments = page.stream()
                .map(id -> java.util.Objects.requireNonNull(byId.get(id)))
                .toList();
        List<CommentDtos.CommentResponse> items = responses(comments, viewerSeq);
        String next = hasNext ? page.get(page.size() - 1).toString() : null;
        return CursorPageResponse.of(items, next, hasNext);
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
        Comment comment = owned(commentSeq, userSeq);
        comment.delete(userSeq);
        postRepository.addCommentCount(comment.getPostSeq(), -1);
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

    private List<CommentDtos.CommentResponse> responses(
            List<Comment> comments,
            Integer viewerSeq
    ) {
        if (comments.isEmpty()) {
            return List.of();
        }
        Set<Integer> authorSeqs = comments.stream()
                .map(Comment::getAuthorSeq)
                .collect(java.util.stream.Collectors.toSet());
        Map<Integer, String> nicknames = new HashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT user_seq, nickname
                  FROM users
                 WHERE user_seq IN (:authorSeqs)
                """, new MapSqlParameterSource("authorSeqs", authorSeqs), rs -> {
            nicknames.put(rs.getInt("user_seq"), rs.getString("nickname"));
        });

        List<Long> commentSeqs = comments.stream().map(Comment::getCommentSeq).toList();
        Set<Long> liked = viewerSeq == null
                ? Set.of()
                : new HashSet<>(namedParameterJdbcTemplate.queryForList("""
                        SELECT comment_seq
                          FROM comment_likes
                         WHERE user_seq = :userSeq
                           AND comment_seq IN (:commentSeqs)
                        """, new MapSqlParameterSource()
                        .addValue("userSeq", viewerSeq)
                        .addValue("commentSeqs", commentSeqs), Long.class));
        return comments.stream().map(comment -> new CommentDtos.CommentResponse(
                comment.getCommentSeq(),
                comment.getPostSeq(),
                comment.getAuthorSeq(),
                nicknames.get(comment.getAuthorSeq()),
                comment.getParentCommentSeq(),
                comment.getContent(),
                comment.getLikeCount(),
                comment.getCommentStatus(),
                liked.contains(comment.getCommentSeq()),
                comment.getRegDttm(),
                comment.getModDttm()
        )).toList();
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
}
