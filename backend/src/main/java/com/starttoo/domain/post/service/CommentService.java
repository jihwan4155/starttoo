package com.starttoo.domain.post.service;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.common.pagination.CursorValues;
import com.starttoo.domain.image.service.ImageReferenceService;
import com.starttoo.domain.post.dto.CommentDtos.*;
import com.starttoo.domain.post.entity.CommentEntity;
import com.starttoo.domain.post.entity.CommentLikeEntity;
import com.starttoo.domain.post.entity.CommentLikeId;
import com.starttoo.domain.post.repository.CommentLikeRepository;
import com.starttoo.domain.post.repository.CommentRepository;
import com.starttoo.domain.post.repository.PostRepository;
import com.starttoo.domain.social.repository.UserBlockRepository;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class CommentService {
    private final CommentRepository commentRepository;
    private final CommentLikeRepository likeRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final UserBlockRepository blockRepository;
    private final ImageReferenceService imageReferenceService;
    private final CursorCodec cursorCodec;

    @Transactional(readOnly=true)
    public CursorPageResponse<CommentResponse> roots(Long viewerId, Long postId, String cursor, int size, String sort) {
        requirePost(viewerId, postId);
        var values = cursorCodec.decode(cursor);
        if ("POPULAR".equals(sort)) {
            long pageNumber = CursorValues.longValue(values, "page", 0);
            var slice = commentRepository.findAllByPostIdAndParentCommentIdIsNull(postId,
                    PageRequest.of((int) pageNumber, size, Sort.by(Sort.Order.desc("likeCount"), Sort.Order.desc("commentId"))));
            var items = slice.getContent().stream().filter(c -> visibleAuthor(viewerId, c.getAuthorId()))
                    .filter(c -> !"DELETED".equals(c.getCommentStatus())
                            || commentRepository.countByParentCommentIdAndCommentStatus(c.getCommentId(), "PUBLISHED") > 0)
                    .map(c -> response(c, viewerId)).toList();
            return new CursorPageResponse<>(items,
                    slice.hasNext() ? cursorCodec.encode(Map.of("page", pageNumber + 1, "sort", "POPULAR")) : null,
                    slice.hasNext());
        }
        long before = CursorValues.longValue(values, "commentId", Long.MAX_VALUE);
        var rows = commentRepository.findAllByPostIdAndParentCommentIdIsNullAndCommentIdLessThan(
                postId, before, PageRequest.of(0, size * 2 + 1, Sort.by(Sort.Order.desc("commentId")))).stream()
                .filter(c -> visibleAuthor(viewerId, c.getAuthorId()))
                .filter(c -> !"DELETED".equals(c.getCommentStatus())
                        || commentRepository.countByParentCommentIdAndCommentStatus(c.getCommentId(), "PUBLISHED") > 0)
                .limit(size + 1L).toList();
        return page(rows, viewerId, size);
    }

    @Transactional(readOnly=true)
    public CursorPageResponse<CommentResponse> replies(Long viewerId, Long rootId, String cursor, int size) {
        var root = commentRepository.findById(rootId).orElseThrow(() -> new BusinessException(ErrorCode.COMMENT_NOT_FOUND));
        if (root.getParentCommentId() != null) throw new BusinessException(ErrorCode.REPLY_PARENT_REQUIRED);
        requirePost(viewerId, root.getPostId());
        long after = CursorValues.longValue(cursorCodec.decode(cursor), "commentId", 0);
        var rows = commentRepository.findAllByParentCommentIdAndCommentIdGreaterThanOrderByCommentIdAsc(
                rootId, after, PageRequest.of(0, size * 2 + 1)).stream()
                .filter(c -> "PUBLISHED".equals(c.getCommentStatus()))
                .filter(c -> visibleAuthor(viewerId, c.getAuthorId())).limit(size + 1L).toList();
        return page(rows, viewerId, size);
    }

    @Transactional
    public CommentResponse create(Long userId, Long postId, CreateCommentRequest request) {
        var post = requirePost(userId, postId);
        CommentEntity parent = null;
        if (request.parentCommentId() != null) {
            parent = commentRepository.findById(request.parentCommentId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.PARENT_COMMENT_NOT_FOUND));
            if (parent.getParentCommentId() != null) throw new BusinessException(ErrorCode.REPLY_DEPTH_EXCEEDED);
            if (!parent.getPostId().equals(postId)) throw new BusinessException(ErrorCode.COMMENT_POST_MISMATCH);
            if (!"PUBLISHED".equals(parent.getCommentStatus())) throw new BusinessException(ErrorCode.PARENT_COMMENT_NOT_FOUND);
        }
        var value = commentRepository.saveAndFlush(CommentEntity.builder().postId(postId).authorId(userId)
                .parentCommentId(parent == null ? null : parent.getCommentId()).content(request.content().trim()).build());
        post.incrementCommentCount();
        return response(value, userId);
    }

    @Transactional
    public void delete(Long userId, Long commentId) {
        var value = commentRepository.findById(commentId).orElseThrow(() -> new BusinessException(ErrorCode.COMMENT_NOT_FOUND));
        if (!value.getAuthorId().equals(userId)) throw new BusinessException(ErrorCode.COMMENT_DELETE_FORBIDDEN);
        long deletedCount = 0;
        if ("PUBLISHED".equals(value.getCommentStatus())) {
            value.delete();
            deletedCount++;
        }
        if (value.getParentCommentId() == null) {
            var activeReplies = commentRepository.findAllByParentCommentIdAndCommentStatus(
                    value.getCommentId(),
                    "PUBLISHED"
            );
            activeReplies.forEach(CommentEntity::delete);
            deletedCount += activeReplies.size();
        }
        if (deletedCount > 0) {
            long finalDeletedCount = deletedCount;
            postRepository.findById(value.getPostId())
                    .ifPresent(post -> post.decrementCommentCount(finalDeletedCount));
        }
    }

    @Transactional
    public CommentLikeResponse like(Long userId, Long commentId, boolean enabled) {
        var value = commentRepository.findById(commentId)
                .filter(c -> "PUBLISHED".equals(c.getCommentStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.COMMENT_NOT_FOUND));
        requirePost(userId, value.getPostId());
        var id = new CommentLikeId(commentId, userId);
        boolean exists = likeRepository.existsById(id);
        if (enabled && !exists) { likeRepository.save(CommentLikeEntity.builder().id(id).build()); value.incrementLikeCount(); }
        if (!enabled && exists) { likeRepository.deleteById(id); value.decrementLikeCount(); }
        return new CommentLikeResponse(commentId, enabled, value.getLikeCount());
    }

    private CursorPageResponse<CommentResponse> page(java.util.List<CommentEntity> rows, Long viewerId, int size) {
        boolean hasNext = rows.size() > size;
        var page = rows.subList(0, Math.min(size, rows.size()));
        var items = page.stream().map(c -> response(c, viewerId)).toList();
        String next = hasNext ? cursorCodec.encode(Map.of("commentId", page.getLast().getCommentId())) : null;
        return new CursorPageResponse<>(items, next, hasNext);
    }

    private CommentResponse response(CommentEntity value, Long viewerId) {
        boolean deleted = "DELETED".equals(value.getCommentStatus());
        CommentAuthor author = null;
        if (!deleted) {
            var user = userRepository.findById(value.getAuthorId()).orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
            author = new CommentAuthor(user.getUserId(), user.getNickname(), imageReferenceService.url(user.getProfileImageKey()));
        }
        boolean liked = viewerId != null && likeRepository.existsById(new CommentLikeId(value.getCommentId(), viewerId));
        long replies = value.getParentCommentId() == null
                ? commentRepository.countByParentCommentIdAndCommentStatus(value.getCommentId(), "PUBLISHED") : 0;
        return new CommentResponse(value.getCommentId(), value.getPostId(), value.getParentCommentId(),
                deleted ? null : value.getContent(), value.getCommentStatus(), author, value.getLikeCount(), liked,
                replies, toInstant(value.getCreatedAt()), toInstant(value.getUpdatedAt()));
    }

    private com.starttoo.domain.post.entity.PostEntity requirePost(Long viewerId, Long postId) {
        var post = postRepository.findById(postId).filter(p -> "PUBLISHED".equals(p.getPostStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND));
        if (viewerId != null && blockRepository.existsEitherDirection(viewerId, post.getAuthorId()))
            throw new BusinessException(ErrorCode.POST_NOT_FOUND);
        return post;
    }
    private boolean visibleAuthor(Long viewerId, Long authorId) {
        return viewerId == null || !blockRepository.existsEitherDirection(viewerId, authorId);
    }
}
