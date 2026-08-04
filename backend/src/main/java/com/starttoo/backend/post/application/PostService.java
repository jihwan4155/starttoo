package com.starttoo.backend.post.application;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final TattooService tattooService;
    private final PostTattooClassificationService postTattooClassificationService;
    private final PostWriteService postWriteService;
    private final PreferenceScoreService preferenceScoreService;
    private final UserService userService;
    private final MediaService mediaService;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public PostDtos.PostResponse create(Integer userSeq, PostDtos.CreatePostRequest request) {
        userService.find(userSeq);
        if (request.imageSeqs().size() != new HashSet<>(request.imageSeqs()).size()) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        List<TattooService.PreparedPostImage> preparedImages = request.imageSeqs().stream()
                .map(imageSeq -> tattooService.preparePostImage(userSeq, imageSeq))
                .toList();
        Post post = postWriteService.create(userSeq, request, preparedImages);
        postTattooClassificationService.classifyAndPersist(userSeq, preparedImages);
        return response(post, userSeq, true);
    }

    @Transactional(readOnly = true)
    public PostDtos.PostResponse get(Long postSeq, Integer viewerSeq) {
        Post post = postRepository.findByPostSeqAndPostStatus(postSeq, PostStatus.PUBLISHED)
                .filter(value -> !value.isDeleted())
                .orElseThrow(() -> BusinessException.of(ErrorCode.POST_NOT_FOUND));
        if (!visibleAuthor(post.getAuthorSeq())
                || viewerSeq != null && (
                blocked(viewerSeq, post.getAuthorSeq())
                        || hidden(viewerSeq, postSeq)
        )) {
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
                  JOIN users author ON author.user_seq = p.author_seq
                 WHERE p.post_status = 'PUBLISHED'
                   AND p.is_deleted = FALSE
                   AND author.account_status = 'ACTIVE'
                   AND author.role <> 'ADMIN'
                   AND author.is_deleted = FALSE
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
        return postSeqPage(ids, safeSize, viewerSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<PostDtos.PostResponse> byUser(
            Integer targetSeq,
            Long cursor,
            int size,
            Integer viewerSeq
    ) {
        ensureVisibleTarget(targetSeq, viewerSeq);
        return list(cursor, size, targetSeq, viewerSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<PostDtos.PostResponse> mine(
            Integer userSeq,
            Long cursor,
            int size
    ) {
        return list(cursor, size, userSeq, userSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<PostDtos.PostResponse> following(
            Integer userSeq,
            Long cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT p.post_seq
                  FROM posts p
                  JOIN users author ON author.user_seq = p.author_seq
                  JOIN user_follows follow
                    ON follow.following_seq = p.author_seq
                   AND follow.follower_seq = ?
                 WHERE p.post_status = 'PUBLISHED'
                   AND p.is_deleted = FALSE
                   AND author.account_status = 'ACTIVE'
                   AND author.role <> 'ADMIN'
                   AND author.is_deleted = FALSE
                   AND (CAST(? AS BIGINT) IS NULL OR p.post_seq < ?)
                   AND NOT EXISTS (
                       SELECT 1 FROM user_blocks block
                        WHERE (block.blocker_seq = ? AND block.blocked_seq = p.author_seq)
                           OR (block.blocker_seq = p.author_seq AND block.blocked_seq = ?)
                   )
                   AND NOT EXISTS (
                       SELECT 1 FROM post_hidden_preferences hidden
                        WHERE hidden.post_seq = p.post_seq
                          AND hidden.user_seq = ?
                   )
                 ORDER BY p.post_seq DESC
                 LIMIT ?
                """, Long.class,
                userSeq,
                cursor, cursor,
                userSeq, userSeq,
                userSeq,
                safeSize + 1
        );
        return postSeqPage(ids, safeSize, userSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<PostDtos.PostResponse> bookmarked(
            Integer userSeq,
            String cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        BookmarkCursor decoded = decodeBookmarkCursor(cursor);
        List<BookmarkRow> rows = jdbcTemplate.query("""
                SELECT p.post_seq, bookmark.reg_dttm AS bookmark_dttm
                  FROM post_bookmarks bookmark
                  JOIN posts p ON p.post_seq = bookmark.post_seq
                  JOIN users author ON author.user_seq = p.author_seq
                 WHERE bookmark.user_seq = ?
                   AND p.post_status = 'PUBLISHED'
                   AND p.is_deleted = FALSE
                   AND author.account_status = 'ACTIVE'
                   AND author.role <> 'ADMIN'
                   AND author.is_deleted = FALSE
                   AND (
                       CAST(? AS TIMESTAMPTZ) IS NULL
                       OR bookmark.reg_dttm < CAST(? AS TIMESTAMPTZ)
                       OR (
                           bookmark.reg_dttm = CAST(? AS TIMESTAMPTZ)
                           AND p.post_seq < ?
                       )
                   )
                   AND NOT EXISTS (
                       SELECT 1 FROM user_blocks block
                        WHERE (block.blocker_seq = ? AND block.blocked_seq = p.author_seq)
                           OR (block.blocker_seq = p.author_seq AND block.blocked_seq = ?)
                   )
                   AND NOT EXISTS (
                       SELECT 1 FROM post_hidden_preferences hidden
                        WHERE hidden.post_seq = p.post_seq
                          AND hidden.user_seq = ?
                   )
                 ORDER BY bookmark.reg_dttm DESC, p.post_seq DESC
                 LIMIT ?
                """, (rs, rowNum) -> new BookmarkRow(
                rs.getLong("post_seq"),
                rs.getObject("bookmark_dttm", OffsetDateTime.class)
        ),
                userSeq,
                decoded == null ? null : decoded.bookmarkDttm(),
                decoded == null ? null : decoded.bookmarkDttm(),
                decoded == null ? null : decoded.bookmarkDttm(),
                decoded == null ? null : decoded.postSeq(),
                userSeq, userSeq,
                userSeq,
                safeSize + 1
        );
        boolean hasNext = rows.size() > safeSize;
        List<BookmarkRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        List<PostDtos.PostResponse> items = responses(loadPosts(
                page.stream().map(BookmarkRow::postSeq).toList()
        ), userSeq);
        String nextCursor = hasNext
                ? encodeBookmarkCursor(page.get(page.size() - 1))
                : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    @Transactional
    public PostDtos.PostResponse update(
            Integer userSeq,
            Long postSeq,
            PostDtos.UpdatePostRequest request
    ) {
        owned(postSeq, userSeq);
        int changed = postRepository.updateContent(
                postSeq,
                userSeq,
                request.content(),
                userSeq,
                OffsetDateTime.now()
        );
        if (changed == 0) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
        return response(owned(postSeq, userSeq), userSeq);
    }

    @Transactional
    public void delete(Integer userSeq, Long postSeq) {
        owned(postSeq, userSeq);
        int changed = postRepository.softDelete(
                postSeq,
                userSeq,
                userSeq,
                OffsetDateTime.now()
        );
        if (changed == 0) {
            throw BusinessException.of(ErrorCode.POST_NOT_FOUND);
        }
    }

    @Transactional
    public boolean setLike(Integer userSeq, Long postSeq, boolean enabled) {
        publishedForUser(postSeq, userSeq);
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
        if (changed > 0 && enabled) {
            preferenceScoreService.applyPostBookmark(userSeq, postSeq, true);
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
        if (changed > 0 && enabled) {
            preferenceScoreService.applyNotInterested(userSeq, postSeq, true);
        }
        return enabled;
    }

    @Transactional
    public void recordDwell(Integer userSeq, Long postSeq, int seconds) {
        publishedForUser(postSeq, userSeq);
        preferenceScoreService.applyDwell(userSeq, postSeq, seconds);
    }

    @Transactional
    public PostDtos.ReportResponse report(
            Integer userSeq,
            Long postSeq,
            PostDtos.ReportRequest request
    ) {
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
            return new PostDtos.ReportResponse(
                    reportSeq,
                    PostDtos.ReportStatus.PENDING
            );
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }
    }

    private PostDtos.PostResponse response(Post post, Integer viewerSeq) {
        return response(post, viewerSeq, false);
    }

    private PostDtos.PostResponse response(
            Post post,
            Integer viewerSeq,
            boolean hideTattooSeq
    ) {
        return responses(List.of(post), viewerSeq, hideTattooSeq).get(0);
    }

    private List<PostDtos.PostResponse> responses(List<Post> posts, Integer viewerSeq) {
        return responses(posts, viewerSeq, false);
    }

    private List<PostDtos.PostResponse> responses(
            List<Post> posts,
            Integer viewerSeq,
            boolean hideTattooSeq
    ) {
        if (posts.isEmpty()) {
            return List.of();
        }
        Set<Integer> authorSeqs = posts.stream()
                .map(Post::getAuthorSeq)
                .collect(java.util.stream.Collectors.toSet());
        Map<Integer, PostDtos.UserSummary> authors = new HashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT author.user_seq,
                       author.nickname,
                       author.role,
                       author.profile_image_seq,
                       profile_image.object_key AS profile_object_key
                  FROM users author
                  LEFT JOIN images profile_image
                    ON profile_image.image_seq = author.profile_image_seq
                   AND profile_image.is_deleted = FALSE
                 WHERE author.user_seq IN (:authorSeqs)
                """, new MapSqlParameterSource("authorSeqs", authorSeqs), rs -> {
            Integer authorSeq = rs.getInt("user_seq");
            authors.put(authorSeq, new PostDtos.UserSummary(
                    authorSeq,
                    rs.getString("nickname"),
                    UserRole.valueOf(rs.getString("role")),
                    rs.getObject("profile_image_seq", Long.class),
                    downloadUrl(rs.getString("profile_object_key"))
            ));
        });

        List<Long> postSeqs = posts.stream().map(Post::getPostSeq).toList();
        Map<Long, List<PostDtos.PostImageResponse>> imagesByPost = new HashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT pi.post_seq,
                       pi.post_image_seq,
                       pi.image_seq,
                       image.object_key AS image_object_key,
                       t.tattoo_seq,
                       pi.display_order
                  FROM post_images pi
                  JOIN images image
                    ON image.image_seq = pi.image_seq
                   AND image.is_deleted = FALSE
                  LEFT JOIN tattoos t ON t.image_seq = pi.image_seq AND t.is_deleted = FALSE
                 WHERE pi.post_seq IN (:postSeqs)
                 ORDER BY pi.post_seq, pi.display_order
                """, new MapSqlParameterSource("postSeqs", postSeqs), rs -> {
            imagesByPost.computeIfAbsent(
                    rs.getLong("post_seq"),
                    ignored -> new java.util.ArrayList<>()
            ).add(new PostDtos.PostImageResponse(
                    rs.getLong("post_image_seq"),
                    rs.getLong("image_seq"),
                    downloadUrl(rs.getString("image_object_key")),
                    hideTattooSeq ? null : rs.getObject("tattoo_seq", Long.class),
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
                Objects.requireNonNull(authors.get(post.getAuthorSeq())),
                post.getContent(),
                post.getLikeCount(),
                post.getCommentCount(),
                imagesByPost.getOrDefault(post.getPostSeq(), List.of()),
                liked.contains(post.getPostSeq()),
                bookmarked.contains(post.getPostSeq()),
                post.getRegDttm(),
                post.getModDttm()
        )).toList();
    }

    @Transactional(readOnly = true)
    public List<PostDtos.PostResponse> responsesBySeqs(
            List<Long> postSeqs,
            Integer viewerSeq
    ) {
        return responses(loadPosts(postSeqs), viewerSeq);
    }

    private CursorPageResponse<PostDtos.PostResponse> postSeqPage(
            List<Long> ids,
            int safeSize,
            Integer viewerSeq
    ) {
        boolean hasNext = ids.size() > safeSize;
        List<Long> page = hasNext ? ids.subList(0, safeSize) : ids;
        List<PostDtos.PostResponse> items = responses(loadPosts(page), viewerSeq);
        String nextCursor = hasNext ? page.get(page.size() - 1).toString() : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    private List<Post> loadPosts(List<Long> postSeqs) {
        Map<Long, Post> byId = new HashMap<>();
        postRepository.findAllById(postSeqs)
                .forEach(value -> byId.put(value.getPostSeq(), value));
        return postSeqs.stream()
                .map(postSeq -> Objects.requireNonNull(byId.get(postSeq)))
                .toList();
    }

    private String downloadUrl(String objectKey) {
        return objectKey == null ? null : mediaService.downloadUrl(objectKey);
    }

    private void ensureVisibleTarget(Integer targetSeq, Integer viewerSeq) {
        User target = userService.find(targetSeq);
        if (target.getAccountStatus() != AccountStatus.ACTIVE
                || target.getRole() == UserRole.ADMIN
                || viewerSeq != null && blocked(viewerSeq, targetSeq)) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
    }

    private boolean visibleAuthor(Integer authorSeq) {
        try {
            User author = userService.find(authorSeq);
            return author.getAccountStatus() == AccountStatus.ACTIVE
                    && author.getRole() != UserRole.ADMIN;
        } catch (BusinessException exception) {
            return false;
        }
    }

    private boolean hidden(Integer userSeq, Long postSeq) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM post_hidden_preferences
                     WHERE user_seq = ? AND post_seq = ?
                )
                """, Boolean.class, userSeq, postSeq));
    }

    private BookmarkCursor decodeBookmarkCursor(String cursor) {
        if (cursor == null) {
            return null;
        }
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(cursor),
                    StandardCharsets.UTF_8
            );
            String[] values = decoded.split("\\|", -1);
            if (values.length != 2) {
                throw BusinessException.of(ErrorCode.INVALID_CURSOR);
            }
            return new BookmarkCursor(
                    OffsetDateTime.parse(values[0]),
                    Long.parseLong(values[1])
            );
        } catch (RuntimeException exception) {
            throw BusinessException.of(ErrorCode.INVALID_CURSOR);
        }
    }

    private String encodeBookmarkCursor(BookmarkRow row) {
        String value = row.bookmarkDttm() + "|" + row.postSeq();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
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

    private record BookmarkRow(Long postSeq, OffsetDateTime bookmarkDttm) {
    }

    private record BookmarkCursor(OffsetDateTime bookmarkDttm, Long postSeq) {
    }
}
