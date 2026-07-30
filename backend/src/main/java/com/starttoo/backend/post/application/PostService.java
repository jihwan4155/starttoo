package com.starttoo.backend.post.application;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.NotificationType;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostImage;
import com.starttoo.backend.post.domain.PostImageRepository;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import com.starttoo.backend.user.application.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
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
public class PostService {

    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;
    private final TattooService tattooService;
    private final PreferenceScoreService preferenceScoreService;
    private final UserService userService;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final NotificationService notificationService;

    @Transactional
    public PostDtos.PostResponse create(Integer userSeq, PostDtos.CreatePostRequest request) {
        userService.find(userSeq);
        if (request.imageSeqs().size() != new HashSet<>(request.imageSeqs()).size()) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        List<Tattoo> tattoos = request.imageSeqs().stream()
                .map(imageSeq -> tattooService.process(userSeq, imageSeq, TattooSourceType.USER_POST))
                .toList();
        OffsetDateTime now = OffsetDateTime.now();
        Post post = postRepository.save(Post.builder()
                .authorSeq(userSeq)
                .content(request.content())
                .postStatus(PostStatus.PUBLISHED)
                .likeCount(0)
                .commentCount(0)
                .reportCount(0)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(userSeq)
                .deleted(false)
                .build());
        for (int index = 0; index < tattoos.size(); index++) {
            postImageRepository.save(PostImage.builder()
                    .postSeq(post.getPostSeq())
                    .imageSeq(tattoos.get(index).getImageSeq())
                    .displayOrder((short) (index + 1))
                    .regDttm(now)
                    .modDttm(now)
                    .build());
        }
        return response(post, userSeq);
    }

    @Transactional(readOnly = true)
    public PostDtos.PostResponse get(Long postSeq, Integer viewerSeq) {
        Post post = postRepository.findByPostSeqAndPostStatus(postSeq, PostStatus.PUBLISHED)
                .filter(value -> !value.isDeleted())
                .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
        if (viewerSeq != null && blocked(viewerSeq, post.getAuthorSeq())) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
        return response(post, viewerSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<PostDtos.PostResponse> list(
            Long cursor,
            int size,
            Integer authorSeq,
            Integer viewerSeq
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT p.post_seq
                  FROM posts p
                 WHERE p.post_status = 'PUBLISHED'
                   AND p.is_deleted = FALSE
                   AND (CAST(? AS BIGINT) IS NULL OR p.post_seq < ?)
                   AND (CAST(? AS INTEGER) IS NULL OR p.author_seq = ?)
                   AND (
                       CAST(? AS INTEGER) IS NULL OR NOT EXISTS (
                           SELECT 1 FROM user_blocks b
                            WHERE (b.blocker_seq = ? AND b.blocked_seq = p.author_seq)
                               OR (b.blocker_seq = p.author_seq AND b.blocked_seq = ?)
                       )
                   )
                   AND (
                       CAST(? AS INTEGER) IS NULL OR NOT EXISTS (
                           SELECT 1 FROM post_hidden_preferences h
                            WHERE h.post_seq = p.post_seq AND h.user_seq = ?
                       )
                   )
                 ORDER BY p.post_seq DESC
                 LIMIT ?
                """, Long.class,
                cursor, cursor,
                authorSeq, authorSeq,
                viewerSeq, viewerSeq, viewerSeq,
                viewerSeq, viewerSeq,
                safeSize + 1
        );
        boolean hasNext = ids.size() > safeSize;
        List<Long> page = hasNext ? ids.subList(0, safeSize) : ids;
        Map<Long, Post> byId = new HashMap<>();
        postRepository.findAllById(page)
                .forEach(value -> byId.put(value.getPostSeq(), value));
        List<Post> posts = page.stream()
                .map(id -> java.util.Objects.requireNonNull(byId.get(id)))
                .toList();
        List<PostDtos.PostResponse> items = responses(posts, viewerSeq);
        String nextCursor = hasNext ? page.get(page.size() - 1).toString() : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    @Transactional
    public PostDtos.PostResponse update(
            Integer userSeq,
            Long postSeq,
            PostDtos.UpdatePostRequest request
    ) {
        Post post = owned(postSeq, userSeq);
        post.updateContent(request.content(), userSeq);
        return response(post, userSeq);
    }

    @Transactional
    public void delete(Integer userSeq, Long postSeq) {
        Post post = owned(postSeq, userSeq);
        post.delete(userSeq);
    }

    @Transactional
    public boolean setLike(Integer userSeq, Long postSeq, boolean enabled) {
        Post post = publishedForUser(postSeq, userSeq);
        int changed;
        if (enabled) {
            changed = jdbcTemplate.update("""
                    INSERT INTO post_likes (post_seq, user_seq)
                    VALUES (?, ?)
                    ON CONFLICT DO NOTHING
                    """, postSeq, userSeq);
            if (changed > 0) {
                postRepository.addLikeCount(postSeq, 1);
                preferenceScoreService.applyPostLike(userSeq, postSeq, true);
                notificationService.create(
                        post.getAuthorSeq(),
                        userSeq,
                        NotificationType.POST_LIKE,
                        postSeq,
                        "게시물 좋아요",
                        "회원님의 게시물에 좋아요가 추가되었습니다."
                );
            }
            return true;
        }
        changed = jdbcTemplate.update(
                "DELETE FROM post_likes WHERE post_seq = ? AND user_seq = ?",
                postSeq,
                userSeq
        );
        if (changed > 0) {
            postRepository.addLikeCount(postSeq, -1);
            preferenceScoreService.applyPostLike(userSeq, postSeq, false);
        }
        return false;
    }

    @Transactional
    public boolean setBookmark(Integer userSeq, Long postSeq, boolean enabled) {
        publishedForUser(postSeq, userSeq);
        int changed;
        if (enabled) {
            changed = jdbcTemplate.update("""
                    INSERT INTO post_bookmarks (post_seq, user_seq)
                    VALUES (?, ?)
                    ON CONFLICT DO NOTHING
                    """, postSeq, userSeq);
        } else {
            changed = jdbcTemplate.update(
                    "DELETE FROM post_bookmarks WHERE post_seq = ? AND user_seq = ?",
                    postSeq,
                    userSeq
            );
        }
        if (changed > 0) {
            preferenceScoreService.applyPostBookmark(userSeq, postSeq, enabled);
        }
        return enabled;
    }

    @Transactional
    public boolean setNotInterested(Integer userSeq, Long postSeq, boolean enabled) {
        publishedForUser(postSeq, userSeq);
        int changed;
        if (enabled) {
            changed = jdbcTemplate.update("""
                    INSERT INTO post_hidden_preferences (post_seq, user_seq)
                    VALUES (?, ?)
                    ON CONFLICT DO NOTHING
                    """, postSeq, userSeq);
        } else {
            changed = jdbcTemplate.update(
                    "DELETE FROM post_hidden_preferences WHERE post_seq = ? AND user_seq = ?",
                    postSeq,
                    userSeq
            );
        }
        if (changed > 0) {
            preferenceScoreService.applyNotInterested(userSeq, postSeq, enabled);
        }
        return enabled;
    }

    @Transactional
    public void recordDwell(Integer userSeq, Long postSeq, int seconds) {
        publishedForUser(postSeq, userSeq);
        preferenceScoreService.applyDwell(userSeq, postSeq, seconds);
    }

    @Transactional
    public Long report(Integer userSeq, Long postSeq, PostDtos.ReportRequest request) {
        publishedForUser(postSeq, userSeq);
        try {
            Long reportSeq = jdbcTemplate.queryForObject("""
                    INSERT INTO post_reports (
                        post_seq, reporter_seq, reason_code, reason_detail, mod_usr_seq
                    ) VALUES (?, ?, ?, ?, ?)
                    RETURNING report_seq
                    """, Long.class,
                    postSeq,
                    userSeq,
                    request.reasonCode(),
                    request.reasonDetail(),
                    userSeq
            );
            postRepository.addReportCount(postSeq, 1);
            return reportSeq;
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }
    }

    private PostDtos.PostResponse response(Post post, Integer viewerSeq) {
        return responses(List.of(post), viewerSeq).get(0);
    }

    private List<PostDtos.PostResponse> responses(List<Post> posts, Integer viewerSeq) {
        if (posts.isEmpty()) {
            return List.of();
        }
        Set<Integer> authorSeqs = posts.stream()
                .map(Post::getAuthorSeq)
                .collect(java.util.stream.Collectors.toSet());
        Map<Integer, String> nicknames = new HashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT user_seq, nickname
                  FROM users
                 WHERE user_seq IN (:authorSeqs)
                """, new MapSqlParameterSource("authorSeqs", authorSeqs), rs -> {
            nicknames.put(rs.getInt("user_seq"), rs.getString("nickname"));
        });

        List<Long> postSeqs = posts.stream().map(Post::getPostSeq).toList();
        Map<Long, List<PostDtos.PostImageResponse>> imagesByPost = new HashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT pi.post_seq,
                       pi.post_image_seq,
                       pi.image_seq,
                       t.tattoo_seq,
                       pi.display_order
                  FROM post_images pi
                  JOIN tattoos t ON t.image_seq = pi.image_seq AND t.is_deleted = FALSE
                 WHERE pi.post_seq IN (:postSeqs)
                 ORDER BY pi.post_seq, pi.display_order
                """, new MapSqlParameterSource("postSeqs", postSeqs), rs -> {
            imagesByPost.computeIfAbsent(
                    rs.getLong("post_seq"),
                    ignored -> new java.util.ArrayList<>()
            ).add(new PostDtos.PostImageResponse(
                    rs.getLong("post_image_seq"),
                    rs.getLong("image_seq"),
                    rs.getLong("tattoo_seq"),
                    rs.getShort("display_order")
            ));
        });

        Set<Long> liked = viewerSeq == null
                ? Set.of()
                : new HashSet<>(namedParameterJdbcTemplate.queryForList("""
                        SELECT post_seq
                          FROM post_likes
                         WHERE user_seq = :userSeq
                           AND post_seq IN (:postSeqs)
                        """, new MapSqlParameterSource()
                        .addValue("userSeq", viewerSeq)
                        .addValue("postSeqs", postSeqs), Long.class));
        Set<Long> bookmarked = viewerSeq == null
                ? Set.of()
                : new HashSet<>(namedParameterJdbcTemplate.queryForList("""
                        SELECT post_seq
                          FROM post_bookmarks
                         WHERE user_seq = :userSeq
                           AND post_seq IN (:postSeqs)
                        """, new MapSqlParameterSource()
                        .addValue("userSeq", viewerSeq)
                        .addValue("postSeqs", postSeqs), Long.class));

        return posts.stream().map(post -> new PostDtos.PostResponse(
                post.getPostSeq(),
                post.getAuthorSeq(),
                nicknames.get(post.getAuthorSeq()),
                post.getContent(),
                post.getPostStatus(),
                post.getLikeCount(),
                post.getCommentCount(),
                imagesByPost.getOrDefault(post.getPostSeq(), List.of()),
                liked.contains(post.getPostSeq()),
                bookmarked.contains(post.getPostSeq()),
                post.getRegDttm(),
                post.getModDttm()
        )).toList();
    }

    private Post published(Long postSeq) {
        return postRepository.findByPostSeqAndPostStatus(postSeq, PostStatus.PUBLISHED)
                .filter(value -> !value.isDeleted())
                .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
    }

    private Post publishedForUser(Long postSeq, Integer userSeq) {
        Post post = published(postSeq);
        if (blocked(userSeq, post.getAuthorSeq())) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
        return post;
    }

    private Post owned(Long postSeq, Integer userSeq) {
        Post post = postRepository.findByPostSeq(postSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
        if (!post.getAuthorSeq().equals(userSeq)) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        if (post.isDeleted()) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
        return post;
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
