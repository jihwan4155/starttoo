package com.starttoo.domain.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record ReportedPostAuthor(
            @Schema(description = "게시글 작성자 회원 ID", example = "202") Long userId,
            @Schema(description = "게시글 작성자 닉네임", example = "inkmaster") String nickname
    ) {
    }

    public record ReportItem(
            @Schema(description = "신고 ID", example = "801") Long reportId,
            @Schema(description = "신고자 회원 ID", example = "301") Long reporterId,
            @Schema(description = "신고 사유 코드", example = "INAPPROPRIATE") String reasonCode,
            @Schema(description = "신고자가 입력한 상세 사유", example = "부적절한 이미지가 포함되어 있습니다.") String reasonDetail,
            @Schema(description = "현재 신고 처리 상태", example = "PENDING") String reportStatus,
            @Schema(description = "관리자 처리 메모. 미처리이면 null") String processingNote,
            @Schema(description = "신고 접수 시각(UTC ISO-8601)") Instant createdAt,
            @Schema(description = "신고 처리 시각. 미처리이면 null") Instant processedAt
    ) {
    }

    public record ReportedPostItem(
            @Schema(description = "신고 대상 게시글 ID", example = "7001") Long postId,
            @Schema(description = "현재 게시글 상태", allowableValues = {"PUBLISHED", "HIDDEN", "DELETED"}) String postStatus,
            @Schema(description = "게시글 작성자") ReportedPostAuthor author,
            @Schema(description = "posts.report_count에 저장된 전체 누적 신고 수", example = "7") long totalReportCount,
            @Schema(description = "요청한 status와 일치하는 신고 수", example = "3") long matchedReportCount,
            @Schema(description = "일치 신고 중 가장 최근 접수 시각") Instant latestReportedAt,
            @Schema(description = "요청한 status와 일치하는 신고 상세. 최신순") List<ReportItem> reports
    ) {
    }

    public record ProcessReportsRequest(
            @NotBlank
            @Schema(description = "모든 PENDING 신고에 적용할 결정", allowableValues = {"ACCEPTED", "REJECTED"}, example = "ACCEPTED")
            String decision,
            @Size(max = 1000)
            @Schema(description = "신고 처리 메모", example = "운영 정책 위반 확인")
            String processingNote
    ) {
    }

    public record ProcessReportsResponse(
            @Schema(description = "처리한 게시글 ID") Long postId,
            @Schema(description = "적용한 결정", allowableValues = {"ACCEPTED", "REJECTED"}) String decision,
            @Schema(description = "이번 요청에서 처리한 PENDING 신고 수") int processedReportCount,
            @Schema(description = "처리 후 게시글 상태") String postStatus,
            @Schema(description = "적용한 처리 메모") String processingNote,
            @Schema(description = "일괄 처리 시각") Instant processedAt
    ) {
    }

    public record TrainingImageItem(
            @Schema(description = "이미지 ID", example = "8201") Long imageId,
            @Schema(description = "images.object_key에 저장된 MinIO 영구 식별자", example = "posts/2026/07/uuid.webp") String objectKey,
            @Schema(description = "학습 사용 여부. 이 목록에서는 항상 false") boolean isUsedForTraining,
            @Schema(description = "학습 완료 시각. 이 목록에서는 null") Instant trainedAt,
            @Schema(description = "이미지 등록 시각") Instant createdAt
    ) {
    }

    public record CompleteTrainingRequest(
            @NotEmpty
            @Size(max = 1000)
            @Schema(description = "학습 완료 처리할 중복 없는 이미지 ID 1~1000개", example = "[8201, 8202, 8203]")
            List<@NotNull Long> imageIds
    ) {
    }

    public record CompleteTrainingResponse(
            @Schema(description = "이번 요청에서 false에서 true로 변경된 이미지 ID") List<Long> completedImageIds,
            @Schema(description = "이미 학습 완료되어 기존 trainedAt을 유지한 이미지 ID") List<Long> alreadyCompletedImageIds,
            @Schema(description = "실제 변경된 행 수") int updatedCount,
            @Schema(description = "이미 완료되어 변경하지 않은 행 수") int alreadyCompletedCount,
            @Schema(description = "요청 대상의 최종 학습 사용 상태. 성공 응답에서는 true") boolean isUsedForTraining,
            @Schema(description = "이번 요청에서 변경된 행에 기록한 시각. 모두 기존 완료 상태였다면 null") Instant trainedAt
    ) {
    }

    public record ArtistApprovalRequest(
            @NotBlank
            @Schema(description = "변경할 승인 상태",
                    allowableValues = {"UNVERIFIED", "PENDING", "ASPIRING", "VERIFIED", "REJECTED"},
                    example = "VERIFIED")
            String approvalStatus,
            @Size(max = 2000)
            @Schema(description = "REJECTED 전환 시 필요한 거절 사유", example = "사업자 정보 확인이 필요합니다.")
            String rejectionReason
    ) {
    }

    public record ArtistApprovalResponse(
            @Schema(description = "타투이스트 회원 ID") Long userId,
            @Schema(description = "변경 후 승인 상태") String approvalStatus,
            @Schema(description = "거절 사유. REJECTED가 아니면 null") String rejectionReason,
            @Schema(description = "VERIFIED 승인 시각. 다른 상태이면 null") Instant approvedAt,
            @Schema(description = "상태 또는 사유가 마지막으로 변경된 시각") Instant updatedAt
    ) {
    }
}
