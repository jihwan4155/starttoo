package com.starttoo.domain.admin.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.domain.admin.dto.AdminDtos.ArtistApprovalRequest;
import com.starttoo.domain.admin.dto.AdminDtos.CompleteTrainingRequest;
import com.starttoo.domain.admin.dto.AdminDtos.ProcessReportsRequest;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock private PostReportRepository reportRepository;
    @Mock private PostRepository postRepository;
    @Mock private UserRepository userRepository;
    @Mock private ImageRepository imageRepository;
    @Mock private TattooArtistRepository artistRepository;
    @Mock private NotificationService notificationService;
    @InjectMocks private AdminService adminService;

    @Test
    void acceptedReportsHidePostAndProcessEveryPendingReport() {
        PostEntity post = PostEntity.builder()
                .postId(7001L).authorId(202L).postType("FEED").postStatus("PUBLISHED").build();
        PostReportEntity first = pendingReport(801L, 7001L, 301L);
        PostReportEntity second = pendingReport(802L, 7001L, 302L);
        when(postRepository.findById(7001L)).thenReturn(Optional.of(post));
        when(reportRepository.findAllByPostIdAndReportStatusOrderByReportIdAsc(7001L, "PENDING"))
                .thenReturn(List.of(first, second));

        var response = adminService.processReports(
                7001L,
                new ProcessReportsRequest("accepted", " 운영 정책 위반 ")
        );

        assertThat(response.processedReportCount()).isEqualTo(2);
        assertThat(response.postStatus()).isEqualTo("HIDDEN");
        assertThat(response.processingNote()).isEqualTo("운영 정책 위반");
        assertThat(first.getReportStatus()).isEqualTo("ACCEPTED");
        assertThat(second.getReportStatus()).isEqualTo("ACCEPTED");
        assertThat(first.getProcessedAt()).isEqualTo(second.getProcessedAt()).isNotNull();
        assertThat(post.getPostStatus()).isEqualTo("HIDDEN");
        verify(notificationService).createSystem(
                301L, NotificationService.REFERENCE_REPORT, 801L,
                "신고 처리 결과가 도착했습니다.",
                "신고한 게시글이 운영 정책에 따라 숨김 처리되었습니다."
        );
        verify(notificationService).createSystem(
                302L, NotificationService.REFERENCE_REPORT, 802L,
                "신고 처리 결과가 도착했습니다.",
                "신고한 게시글이 운영 정책에 따라 숨김 처리되었습니다."
        );
    }

    @Test
    void acceptedReportsDoNotReviveDeletedPost() {
        PostEntity post = PostEntity.builder()
                .postId(7001L).authorId(202L).postType("FEED").postStatus("DELETED").build();
        when(postRepository.findById(7001L)).thenReturn(Optional.of(post));
        when(reportRepository.findAllByPostIdAndReportStatusOrderByReportIdAsc(7001L, "PENDING"))
                .thenReturn(List.of(pendingReport(801L, 7001L, 301L)));

        var response = adminService.processReports(
                7001L,
                new ProcessReportsRequest("ACCEPTED", null)
        );

        assertThat(response.postStatus()).isEqualTo("DELETED");
        assertThat(post.getPostStatus()).isEqualTo("DELETED");
    }

    @Test
    void missingTrainingImageIsRejectedBeforeAnyImageChanges() {
        ImageEntity existing = ImageEntity.builder()
                .imageId(8201L).objectKey("posts/a.webp").usedForTraining(false).build();
        when(imageRepository.findAllByImageIdInForUpdate(List.of(8201L, 9999L))).thenReturn(List.of(existing));

        assertThatThrownBy(() -> adminService.completeTraining(
                new CompleteTrainingRequest(List.of(8201L, 9999L))))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                        .isEqualTo(ErrorCode.IMAGE_NOT_FOUND));

        assertThat(existing.isUsedForTraining()).isFalse();
        assertThat(existing.getTrainedAt()).isNull();
    }

    @Test
    void completeTrainingChangesOnlyPreviouslyUntrainedImages() {
        LocalDateTime originalTrainedAt = LocalDateTime.of(2026, 7, 1, 10, 0);
        ImageEntity untrained = ImageEntity.builder()
                .imageId(8201L).objectKey("posts/a.webp").usedForTraining(false).build();
        ImageEntity trained = ImageEntity.builder()
                .imageId(8202L).objectKey("posts/b.webp").usedForTraining(true)
                .trainedAt(originalTrainedAt).build();
        when(imageRepository.findAllByImageIdInForUpdate(List.of(8201L, 8202L))).thenReturn(List.of(untrained, trained));

        var response = adminService.completeTraining(
                new CompleteTrainingRequest(List.of(8201L, 8202L)));

        assertThat(response.completedImageIds()).containsExactly(8201L);
        assertThat(response.alreadyCompletedImageIds()).containsExactly(8202L);
        assertThat(untrained.isUsedForTraining()).isTrue();
        assertThat(untrained.getTrainedAt()).isNotNull();
        assertThat(trained.getTrainedAt()).isEqualTo(originalTrainedAt);
    }

    @Test
    void verifiesArtistAndRecordsApprovalTime() {
        UserEntity user = UserEntity.builder()
                .userId(202L).oauthProvider("GOOGLE").oauthSubject("artist-202")
                .nickname("inkmaster").profileImageKey("system/profile/default-profile.webp")
                .role("ARTIST").build();
        TattooArtistEntity artist = TattooArtistEntity.builder()
                .userId(202L).approvalStatus("PENDING").rejectionReason("이전 사유").build();
        when(userRepository.findById(202L)).thenReturn(Optional.of(user));
        when(artistRepository.findByUserIdForUpdate(202L)).thenReturn(Optional.of(artist));

        var response = adminService.changeArtistApproval(
                202L,
                new ArtistApprovalRequest("VERIFIED", null)
        );

        assertThat(response.approvalStatus()).isEqualTo("VERIFIED");
        assertThat(response.rejectionReason()).isNull();
        assertThat(response.approvedAt()).isNotNull();
        assertThat(artist.getApprovedAt()).isNotNull();
        verify(notificationService).createSystem(
                202L, NotificationService.REFERENCE_ARTIST, 202L,
                "타투이스트 승인 상태가 변경되었습니다.",
                "현재 승인 상태는 VERIFIED입니다."
        );
    }

    private PostReportEntity pendingReport(Long reportId, Long postId, Long reporterId) {
        return PostReportEntity.builder()
                .reportId(reportId)
                .postId(postId)
                .reporterId(reporterId)
                .reasonCode("INAPPROPRIATE")
                .reportStatus("PENDING")
                .build();
    }
}
