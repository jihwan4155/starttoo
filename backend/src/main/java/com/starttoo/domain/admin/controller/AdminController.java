package com.starttoo.domain.admin.controller;

import com.starttoo.common.api.PageResponse;
import com.starttoo.common.openapi.CommonApiResponses;
import com.starttoo.domain.admin.dto.AdminDtos.*;
import com.starttoo.domain.admin.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@Tag(name = "Admin", description = "게시글 신고·학습 이미지·타투이스트 승인 관리")
@SecurityRequirement(name = "bearerAuth")
@RestController
@CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/admin")
public class AdminController {

    private final AdminService adminService;

    @Operation(summary = "신고 게시글 목록 조회")
    @GetMapping("/reported-posts")
    public PageResponse<ReportedPostItem> reportedPosts(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "LATEST") String sort,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return adminService.reportedPosts(status, sort, page, size);
    }

    @Operation(summary = "신고 게시글 처리")
    @PatchMapping("/reported-posts/{postId}")
    public ProcessReportsResponse processReports(
            @PathVariable Long postId,
            @Valid @RequestBody ProcessReportsRequest request
    ) {
        return adminService.processReports(postId, request);
    }

    @Operation(summary = "학습 미사용 이미지 목록 조회")
    @GetMapping("/training/images")
    public PageResponse<TrainingImageItem> untrainedImages(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return adminService.untrainedImages(page, size);
    }

    @Operation(summary = "이미지 데이터 학습 완료 처리")
    @PatchMapping("/training/images/complete")
    public CompleteTrainingResponse completeTraining(
            @Valid @RequestBody CompleteTrainingRequest request
    ) {
        return adminService.completeTraining(request);
    }

    @Operation(summary = "타투이스트 승인 상태 변경")
    @PatchMapping("/artists/{userId}/approval-status")
    public ArtistApprovalResponse changeArtistApproval(
            @PathVariable Long userId,
            @Valid @RequestBody ArtistApprovalRequest request
    ) {
        return adminService.changeArtistApproval(userId, request);
    }
}
