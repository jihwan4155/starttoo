package com.starttoo.domain.admin.service;

import com.starttoo.common.api.PageResponse;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.domain.admin.dto.AdminDtos.*;
import com.starttoo.domain.artist.entity.TattooArtistEntity;
import com.starttoo.domain.artist.repository.TattooArtistRepository;
import com.starttoo.domain.image.entity.ImageEntity;
import com.starttoo.domain.image.repository.ImageRepository;
import com.starttoo.domain.notification.service.NotificationService;
import com.starttoo.domain.post.entity.PostEntity;
import com.starttoo.domain.post.entity.PostReportEntity;
import com.starttoo.domain.post.repository.PostReportRepository;
import com.starttoo.domain.post.repository.PostRepository;
import com.starttoo.domain.user.entity.UserEntity;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class AdminService {

    private static final Set<String> REPORT_STATUSES = Set.of("PENDING", "ACCEPTED", "REJECTED");
    private static final Set<String> REPORT_SORTS = Set.of("LATEST", "MOST_REPORTED");
    private static final Set<String> APPROVAL_STATUSES = Set.of(
            "UNVERIFIED", "PENDING", "ASPIRING", "VERIFIED", "REJECTED"
    );

    private final PostReportRepository reportRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final ImageRepository imageRepository;
    private final TattooArtistRepository artistRepository;
    private final NotificationService notificationService;
    private final Clock clock = Clock.systemUTC();

    @Transactional(readOnly = true)
    public PageResponse<ReportedPostItem> reportedPosts(
            String status,
            String sort,
            int page,
            int size
    ) {
        validatePage(page, size);
        String normalizedStatus = normalize(status, "PENDING");
        String normalizedSort = normalize(sort, "LATEST");
        if (!REPORT_STATUSES.contains(normalizedStatus) || !REPORT_SORTS.contains(normalizedSort)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "신고 상태 또는 정렬값이 올바르지 않습니다.");
        }

        PageRequest pageable = PageRequest.of(page - 1, size);
        Page<Long> postIdPage = "MOST_REPORTED".equals(normalizedSort)
                ? reportRepository.findReportedPostIdsMostReported(normalizedStatus, pageable)
                : reportRepository.findReportedPostIdsLatest(normalizedStatus, pageable);

        List<Long> postIds = postIdPage.getContent();
        if (postIds.isEmpty()) {
            return pageResponse(List.of(), page, size, postIdPage);
        }

        Map<Long, PostEntity> posts = postRepository.findAllById(postIds).stream()
                .collect(Collectors.toMap(PostEntity::getPostId, Function.identity()));
        Set<Long> authorIds = posts.values().stream().map(PostEntity::getAuthorId).collect(Collectors.toSet());
        Map<Long, UserEntity> authors = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(UserEntity::getUserId, Function.identity()));

        Map<Long, List<PostReportEntity>> reportsByPost = reportRepository
                .findAllByPostIdInAndReportStatusOrderByCreatedAtDescReportIdDesc(postIds, normalizedStatus)
                .stream().collect(Collectors.groupingBy(
                        PostReportEntity::getPostId,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<ReportedPostItem> items = postIds.stream().map(postId -> {
            PostEntity post = requirePost(posts, postId);
            UserEntity author = authors.get(post.getAuthorId());
            if (author == null) {
                throw new BusinessException(ErrorCode.USER_NOT_FOUND);
            }
            List<PostReportEntity> reports = reportsByPost.getOrDefault(postId, List.of());
            Instant latestReportedAt = reports.stream().map(PostReportEntity::getCreatedAt)
                    .max(LocalDateTime::compareTo).map(com.starttoo.common.time.TimeMapper::toInstant).orElse(null);
            return new ReportedPostItem(
                    postId,
                    post.getPostStatus(),
                    new ReportedPostAuthor(author.getUserId(), author.getNickname()),
                    post.getReportCount(),
                    reports.size(),
                    latestReportedAt,
                    reports.stream().map(this::reportItem).toList()
            );
        }).toList();

        return pageResponse(items, page, size, postIdPage);
    }

    @Transactional
    public ProcessReportsResponse processReports(Long postId, ProcessReportsRequest request) {
        PostEntity post = postRepository.findById(postId)
                .orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND));
        String decision = normalize(request.decision(), null);
        if (decision == null || !Set.of("ACCEPTED", "REJECTED").contains(decision)) {
            throw new BusinessException(ErrorCode.REPORT_DECISION_INVALID);
        }
        if (request.processingNote() != null && request.processingNote().length() > 1000) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "신고 처리 메모는 1000자 이하여야 합니다.");
        }
        List<PostReportEntity> pending = reportRepository
                .findAllByPostIdAndReportStatusOrderByReportIdAsc(postId, "PENDING");
        if (pending.isEmpty()) {
            throw new BusinessException(ErrorCode.NO_PENDING_REPORTS);
        }

        String note = trimNullable(request.processingNote());
        LocalDateTime now = now();
        pending.forEach(report -> report.process(decision, note, now));
        if ("ACCEPTED".equals(decision)) {
            post.hideByModeration();
        }
        String notificationBody = "ACCEPTED".equals(decision)
                ? "신고한 게시글이 운영 정책에 따라 숨김 처리되었습니다."
                : "신고한 게시글이 운영 정책 위반으로 판단되지 않아 반려되었습니다.";
        pending.forEach(report -> notificationService.createSystem(
                report.getReporterId(),
                NotificationService.REFERENCE_REPORT,
                report.getReportId(),
                "신고 처리 결과가 도착했습니다.",
                notificationBody
        ));
        return new ProcessReportsResponse(
                postId, decision, pending.size(), post.getPostStatus(), note, toInstant(now)
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<TrainingImageItem> untrainedImages(int page, int size) {
        validatePage(page, size);
        Page<ImageEntity> result = imageRepository.findAllByUsedForTrainingFalse(
                PageRequest.of(page - 1, size, Sort.by(
                        Sort.Order.desc("createdAt"),
                        Sort.Order.desc("imageId")
                ))
        );
        List<TrainingImageItem> items = result.getContent().stream().map(image -> new TrainingImageItem(
                image.getImageId(), image.getObjectKey(), image.isUsedForTraining(),
                toInstant(image.getTrainedAt()), toInstant(image.getCreatedAt())
        )).toList();
        return pageResponse(items, page, size, result);
    }

    @Transactional
    public CompleteTrainingResponse completeTraining(CompleteTrainingRequest request) {
        List<Long> imageIds = request.imageIds();
        if (imageIds == null || imageIds.isEmpty() || imageIds.size() > 1000) {
            throw new BusinessException(ErrorCode.IMAGE_IDS_INVALID);
        }
        if (new HashSet<>(imageIds).size() != imageIds.size()) {
            throw new BusinessException(ErrorCode.IMAGE_IDS_DUPLICATED);
        }

        Map<Long, ImageEntity> images = imageRepository.findAllByImageIdInForUpdate(imageIds).stream()
                .collect(Collectors.toMap(ImageEntity::getImageId, Function.identity()));
        if (images.size() != imageIds.size()) {
            throw new BusinessException(ErrorCode.IMAGE_NOT_FOUND);
        }

        LocalDateTime now = now();
        List<Long> completed = new ArrayList<>();
        List<Long> alreadyCompleted = new ArrayList<>();
        for (Long imageId : imageIds) {
            if (images.get(imageId).completeTraining(now)) {
                completed.add(imageId);
            } else {
                alreadyCompleted.add(imageId);
            }
        }
        return new CompleteTrainingResponse(
                completed,
                alreadyCompleted,
                completed.size(),
                alreadyCompleted.size(),
                true,
                completed.isEmpty() ? null : toInstant(now)
        );
    }

    @Transactional
    public ArtistApprovalResponse changeArtistApproval(
            Long userId,
            ArtistApprovalRequest request
    ) {
        UserEntity user = userRepository.findById(userId)
                .filter(value -> "ARTIST".equals(value.getRole()))
                .orElseThrow(() -> new BusinessException(ErrorCode.ARTIST_PROFILE_NOT_FOUND));
        TattooArtistEntity artist = artistRepository.findByUserIdForUpdate(user.getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.ARTIST_PROFILE_NOT_FOUND));

        String status = normalize(request.approvalStatus(), null);
        if (status == null || !APPROVAL_STATUSES.contains(status)) {
            throw new BusinessException(ErrorCode.APPROVAL_STATUS_INVALID);
        }
        String reason = trimNullable(request.rejectionReason());
        if (reason != null && reason.length() > 2000) {
            throw new BusinessException(ErrorCode.REJECTION_REASON_TOO_LONG);
        }

        LocalDateTime now = now();
        boolean changed = !status.equals(artist.getApprovalStatus());
        if ("REJECTED".equals(status)) {
            if (!changed && reason == null) {
                reason = artist.getRejectionReason();
            }
            if (reason == null) {
                throw new BusinessException(ErrorCode.REJECTION_REASON_REQUIRED);
            }
            changed = changed || !reason.equals(artist.getRejectionReason());
            if (changed) {
                artist.changeApprovalStatus(status, reason, null);
            }
        } else if ("VERIFIED".equals(status)) {
            if (changed) {
                artist.changeApprovalStatus(status, null, now);
            }
        } else if (changed) {
            artist.changeApprovalStatus(status, null, null);
        }

        if (changed) {
            notificationService.createSystem(
                    userId,
                    NotificationService.REFERENCE_ARTIST,
                    userId,
                    "타투이스트 승인 상태가 변경되었습니다.",
                    "현재 승인 상태는 " + status + "입니다."
            );
        }
        Instant updatedAt = changed ? toInstant(now) : toInstant(artist.getUpdatedAt());
        return new ArtistApprovalResponse(
                userId,
                artist.getApprovalStatus(),
                artist.getRejectionReason(),
                toInstant(artist.getApprovedAt()),
                updatedAt
        );
    }

    private ReportItem reportItem(PostReportEntity report) {
        return new ReportItem(
                report.getReportId(),
                report.getReporterId(),
                report.getReasonCode(),
                report.getReasonDetail(),
                report.getReportStatus(),
                report.getProcessingNote(),
                toInstant(report.getCreatedAt()),
                toInstant(report.getProcessedAt())
        );
    }

    private PostEntity requirePost(Map<Long, PostEntity> posts, Long postId) {
        PostEntity post = posts.get(postId);
        if (post == null) {
            throw new BusinessException(ErrorCode.POST_NOT_FOUND);
        }
        return post;
    }

    private <T> PageResponse<T> pageResponse(
            List<T> items,
            int requestedPage,
            int size,
            Page<?> page
    ) {
        return new PageResponse<>(
                items,
                requestedPage,
                size,
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasPrevious(),
                page.hasNext()
        );
    }

    private String normalize(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value.trim().toUpperCase();
    }

    private String trimNullable(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 50) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "page는 1 이상, size는 1~50이어야 합니다.");
        }
    }
}
