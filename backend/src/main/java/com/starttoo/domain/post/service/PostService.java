package com.starttoo.domain.post.service;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.common.pagination.CursorValues;
import com.starttoo.domain.image.service.ImageReferenceService;
import com.starttoo.domain.post.dto.PostDtos.*;
import com.starttoo.domain.post.entity.*;
import com.starttoo.domain.post.repository.*;
import com.starttoo.domain.social.repository.UserBlockRepository;
import com.starttoo.domain.social.repository.UserFollowRepository;
import com.starttoo.domain.tattoo.entity.TattooEntity;
import com.starttoo.domain.tattoo.repository.TattooRepository;
import com.starttoo.domain.user.entity.UserEntity;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.*;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;
    private final PostLikeRepository likeRepository;
    private final PostBookmarkRepository bookmarkRepository;
    private final PostHiddenPreferenceRepository hiddenRepository;
    private final PostReportRepository reportRepository;
    private final UserRepository userRepository;
    private final UserFollowRepository followRepository;
    private final UserBlockRepository blockRepository;
    private final TattooRepository tattooRepository;
    private final ImageReferenceService imageReferenceService;
    private final CursorCodec cursorCodec;
    private final Clock clock = Clock.systemUTC();

    @Transactional(readOnly=true)
    public CursorPageResponse<PostResponse> publicFeed(String cursor, int size, String sort, String postType, Long authorId) {
        var values = cursorCodec.decode(cursor);
        if ("POPULAR".equals(sort)) {
            long pageNumber = CursorValues.longValue(values, "page", 0);
            var slice = postRepository.findPublicPage(normalize(postType), authorId,
                    PageRequest.of((int)pageNumber, size, Sort.by(Sort.Order.desc("likeCount"), Sort.Order.desc("postId"))));
            var items = slice.getContent().stream().map(post -> response(post, null, null)).toList();
            return new CursorPageResponse<>(items,
                    slice.hasNext() ? cursorCodec.encode(Map.of("page", pageNumber + 1, "sort", "POPULAR")) : null,
                    slice.hasNext());
        }
        long before = CursorValues.longValue(values, "postId", Long.MAX_VALUE);
        var rows = postRepository.findPublic(normalize(postType), authorId, before,
                PageRequest.of(0, size + 1, Sort.by(Sort.Order.desc("postId"))));
        return page(rows, size, null, false);
    }

    @Transactional(readOnly=true)
    public PostResponse detail(Long viewerId, Long postId) {
        return response(requireVisible(viewerId, postId), viewerId, null);
    }

    @Transactional
    public PostResponse create(Long userId, CreatePostRequest request) {
        UserEntity author = requireActiveUser(userId);
        validatePostType(request.postType(), author.getRole());
        validateContent(request.content());
        var post = postRepository.saveAndFlush(PostEntity.builder().authorId(userId)
                .postType(request.postType()).content(request.content()).build());
        int order = 0;
        for (ImageObject input : request.images()) {
            var image = imageReferenceService.register(input.objectKey(), userId);
            if (tattooRepository.existsByImageId(image.getImageId()))
                throw new BusinessException(ErrorCode.CONFLICT, "이미 사용된 게시글 이미지 objectKey입니다.");
            postImageRepository.save(PostImageEntity.builder().postId(post.getPostId())
                    .imageId(image.getImageId()).displayOrder(order++).build());
            tattooRepository.save(TattooEntity.builder().userId(userId).imageId(image.getImageId())
                    .sourceType("USER_POST").build());
        }
        return response(post, userId, null);
    }

    @Transactional
    public PostResponse update(Long userId, Long postId, UpdatePostRequest request) {
        var post = requireExisting(postId);
        if (!post.getAuthorId().equals(userId)) throw new BusinessException(ErrorCode.POST_EDIT_FORBIDDEN);
        String type = request.postType() == null ? post.getPostType() : request.postType();
        validatePostType(type, requireActiveUser(userId).getRole());
        validateContent(request.content());
        var old = postImageRepository.findAllByPostIdOrderByDisplayOrderAsc(postId);
        List<PostImageEntity> retained;
        if (request.retainedPostImageIds() == null) {
            retained = new ArrayList<>(old);
        } else {
            if (new HashSet<>(request.retainedPostImageIds()).size() != request.retainedPostImageIds().size()) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST, "유지할 이미지 ID가 올바르지 않습니다.");
            }
            Map<Long, PostImageEntity> byId = new HashMap<>();
            old.forEach(value -> byId.put(value.getPostImageId(), value));
            retained = request.retainedPostImageIds().stream().map(id -> {
                var value = byId.get(id);
                if (value == null) throw new BusinessException(ErrorCode.INVALID_REQUEST, "유지할 이미지 ID가 올바르지 않습니다.");
                return value;
            }).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
            old.stream().filter(value -> !request.retainedPostImageIds().contains(value.getPostImageId()))
                    .forEach(postImageRepository::delete);
        }
        int newCount = request.newImages() == null ? 0 : request.newImages().size();
        if (retained.isEmpty() && newCount == 0) throw new BusinessException(ErrorCode.INVALID_REQUEST, "게시글 이미지가 필요합니다.");
        if (retained.size() + newCount > 10) throw new BusinessException(ErrorCode.INVALID_REQUEST, "게시글 이미지는 최대 10장입니다.");
        int order = 0;
        for (var image : retained) image.reorder(order++);
        if (request.newImages() != null) {
            for (ImageObject input : request.newImages()) {
                var image = imageReferenceService.register(input.objectKey(), userId);
                if (tattooRepository.existsByImageId(image.getImageId()))
                    throw new BusinessException(ErrorCode.CONFLICT, "이미 사용된 게시글 이미지 objectKey입니다.");
                postImageRepository.save(PostImageEntity.builder().postId(postId).imageId(image.getImageId()).displayOrder(order++).build());
                tattooRepository.save(TattooEntity.builder().userId(userId).imageId(image.getImageId()).sourceType("USER_POST").build());
            }
        }
        post.update(type, request.content());
        return response(post, userId, null);
    }

    @Transactional
    public void delete(Long userId, Long postId) {
        var post = requireExisting(postId);
        if (!post.getAuthorId().equals(userId)) throw new BusinessException(ErrorCode.POST_DELETE_FORBIDDEN);
        post.delete();
    }

    @Transactional
    public LikeResponse like(Long userId, Long postId, boolean enabled) {
        var post = requireVisible(userId, postId);
        var id = new PostUserId(postId, userId);
        boolean exists = likeRepository.existsById(id);
        if (enabled && !exists) {
            likeRepository.save(PostLikeEntity.builder().id(id).build());
            post.incrementLikeCount();
        } else if (!enabled && exists) {
            likeRepository.deleteById(id);
            post.decrementLikeCount();
        }
        return new LikeResponse(postId, enabled, post.getLikeCount());
    }

    @Transactional
    public BookmarkResponse bookmark(Long userId, Long postId, boolean enabled) {
        requireVisible(userId, postId);
        var id = new PostUserId(postId, userId);
        if (enabled && !bookmarkRepository.existsById(id)) bookmarkRepository.save(PostBookmarkEntity.builder().id(id).build());
        if (!enabled && bookmarkRepository.existsById(id)) bookmarkRepository.deleteById(id);
        return new BookmarkResponse(postId, enabled);
    }

    @Transactional
    public HiddenResponse hidden(Long userId, Long postId, boolean enabled) {
        requireVisible(userId, postId);
        var id = new PostUserId(postId, userId);
        if (enabled && !hiddenRepository.existsById(id)) hiddenRepository.save(PostHiddenPreferenceEntity.builder().id(id).build());
        if (!enabled && hiddenRepository.existsById(id)) hiddenRepository.deleteById(id);
        return new HiddenResponse(postId, enabled);
    }

    @Transactional
    public ReportResponse report(Long userId, Long postId, ReportRequest request) {
        var post = requireVisible(userId, postId);
        if (post.getAuthorId().equals(userId)) throw new BusinessException(ErrorCode.CANNOT_REPORT_OWN_POST);
        if (reportRepository.existsByPostIdAndReporterId(postId, userId)) throw new BusinessException(ErrorCode.POST_ALREADY_REPORTED);
        if ("OTHER".equals(request.reasonCode()) && (request.reasonDetail() == null || request.reasonDetail().isBlank())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "OTHER 신고에는 상세 사유가 필요합니다.");
        }
        if (!List.of("SPAM", "INAPPROPRIATE", "HARASSMENT", "COPYRIGHT", "OTHER").contains(request.reasonCode())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "신고 사유가 올바르지 않습니다.");
        }
        var value = reportRepository.saveAndFlush(PostReportEntity.builder().postId(postId).reporterId(userId)
                .reasonCode(request.reasonCode()).reasonDetail(request.reasonDetail()).build());
        post.incrementReportCount();
        return new ReportResponse(value.getReportId(), postId, value.getReasonCode(), value.getReasonDetail(),
                value.getReportStatus(), value.getCreatedAt() == null ? Instant.now(clock) : toInstant(value.getCreatedAt()));
    }

    @Transactional(readOnly=true)
    public CursorPageResponse<PostResponse> following(Long userId, String cursor, int size, String sort) {
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "postId", Long.MAX_VALUE);
        var follows = followRepository.findAllByIdFollowerIdAndIdFollowingIdLessThanOrderByIdFollowingIdDesc(
                userId, Long.MAX_VALUE, PageRequest.of(0, 10000));
        Set<Long> authors = follows.stream().map(v -> v.getId().getFollowingId()).collect(java.util.stream.Collectors.toSet());
        var candidates = postRepository.findPublic(null, null, before, PageRequest.of(0, Math.max(100, size * 10),
                "POPULAR".equals(sort) ? Sort.by(Sort.Order.desc("likeCount"), Sort.Order.desc("postId")) : Sort.by(Sort.Order.desc("postId"))));
        var rows = candidates.stream().filter(p -> authors.contains(p.getAuthorId()))
                .filter(p -> !hiddenRepository.existsById(new PostUserId(p.getPostId(), userId)))
                .filter(p -> !blockRepository.existsEitherDirection(userId, p.getAuthorId())).limit(size + 1L).toList();
        return page(rows, size, userId, true);
    }

    @Transactional(readOnly=true)
    public CursorPageResponse<PostResponse> mine(Long userId, String cursor, int size, String status) {
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "postId", Long.MAX_VALUE);
        var rows = postRepository.findAllByAuthorIdAndPostIdLessThanAndPostStatusNotOrderByPostIdDesc(
                userId, before, "DELETED", PageRequest.of(0, size * 3 + 1));
        if (status != null && !"ALL".equals(status)) rows = rows.stream().filter(p -> status.equals(p.getPostStatus())).toList();
        return page(rows.stream().limit(size + 1L).toList(), size, userId, true);
    }

    @Transactional(readOnly=true)
    public CursorPageResponse<PostResponse> byUser(Long viewerId, Long targetId, String cursor, int size) {
        if (viewerId != null && viewerId.equals(targetId)) throw new BusinessException(ErrorCode.USE_MY_POSTS_ENDPOINT);
        requireActiveUser(targetId);
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "postId", Long.MAX_VALUE);
        var rows = postRepository.findPublic(null, targetId, before, PageRequest.of(0, size + 1, Sort.by(Sort.Order.desc("postId"))));
        if (viewerId != null && blockRepository.existsEitherDirection(viewerId, targetId)) throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        return page(rows, size, viewerId, true);
    }

    @Transactional(readOnly=true)
    public CursorPageResponse<PostResponse> bookmarks(Long userId, String cursor, int size) {
        long pageNumber = CursorValues.longValue(cursorCodec.decode(cursor), "page", 0);
        var bookmarkSlice = bookmarkRepository.findAllByIdUserIdOrderByCreatedAtDesc(userId, PageRequest.of((int)pageNumber, size));
        var rows = bookmarkSlice.stream().map(value -> postRepository.findById(value.getId().getPostId()).orElse(null))
                .filter(Objects::nonNull).filter(p -> "PUBLISHED".equals(p.getPostStatus()))
                .filter(p -> !blockRepository.existsEitherDirection(userId, p.getAuthorId())).toList();
        boolean hasNext = bookmarkSlice.hasNext();
        var page = rows;
        var items = page.stream().map(p -> response(p, userId, null)).toList();
        return new CursorPageResponse<>(items, hasNext ? cursorCodec.encode(Map.of("page", pageNumber + 1)) : null, hasNext);
    }

    private CursorPageResponse<PostResponse> page(List<PostEntity> rows, int size, Long viewerId, boolean personalized) {
        boolean hasNext = rows.size() > size;
        var page = rows.subList(0, Math.min(size, rows.size()));
        var items = page.stream().map(post -> response(post, personalized ? viewerId : null, null)).toList();
        String next = hasNext ? cursorCodec.encode(Map.of("postId", page.getLast().getPostId())) : null;
        return new CursorPageResponse<>(items, next, hasNext);
    }

    private PostResponse response(PostEntity post, Long viewerId, Instant bookmarkedAt) {
        UserEntity author = userRepository.findById(post.getAuthorId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        var images = postImageRepository.findAllByPostIdOrderByDisplayOrderAsc(post.getPostId()).stream()
                .map(value -> new PostImage(value.getPostImageId(), value.getImageId(),
                        imageReferenceService.url(value.getImageId()), value.getDisplayOrder())).toList();
        var id = viewerId == null ? null : new PostUserId(post.getPostId(), viewerId);
        return new PostResponse(post.getPostId(), post.getPostType(), post.getContent(), post.getPostStatus(),
                new Author(author.getUserId(), author.getNickname(), imageReferenceService.url(author.getProfileImageKey()), author.getRole()),
                images, post.getLikeCount(), post.getCommentCount(), id != null && likeRepository.existsById(id),
                id != null && bookmarkRepository.existsById(id), id != null && hiddenRepository.existsById(id),
                bookmarkedAt, toInstant(post.getCreatedAt()), toInstant(post.getUpdatedAt()));
    }

    private PostEntity requireVisible(Long viewerId, Long postId) {
        PostEntity post = requireExisting(postId);
        if (!"PUBLISHED".equals(post.getPostStatus())) throw new BusinessException(ErrorCode.POST_NOT_FOUND);
        if (viewerId != null && blockRepository.existsEitherDirection(viewerId, post.getAuthorId())) throw new BusinessException(ErrorCode.POST_NOT_FOUND);
        return post;
    }
    private PostEntity requireExisting(Long id) { return postRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND)); }
    private UserEntity requireActiveUser(Long id) {
        var user = userRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        if (!"ACTIVE".equals(user.getAccountStatus())) throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        return user;
    }
    private void validatePostType(String type, String role) {
        if (!List.of("USER_POST", "ARTIST_WORK").contains(type)) throw new BusinessException(ErrorCode.INVALID_REQUEST);
        if ("ARTIST_WORK".equals(type) && !"ARTIST".equals(role)) throw new BusinessException(ErrorCode.FORBIDDEN);
    }
    private void validateContent(String content) {
        if (content != null && content.trim().isEmpty()) throw new BusinessException(ErrorCode.INVALID_REQUEST, "게시글 본문은 공백일 수 없습니다.");
    }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value; }
}
