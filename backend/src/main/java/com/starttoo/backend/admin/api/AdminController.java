package com.starttoo.backend.admin.api;

import com.starttoo.backend.admin.application.AdminService;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin Accounts & Reports", description = "관리자 계정 상태 및 신고 처리")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    private final AdminService adminService;

    @PatchMapping("/users/{userSeq}/status")
    @Operation(
            summary = "회원 계정 상태 변경",
            description = """
                    ADMIN이 ACTIVE, SUSPENDED, BANNED, WITHDRAWN 상태를 변경한다. SUSPENDED에는
                    미래 만료 시각이 필수다. users 현재 상태 변경, 사유·만료 시각을 포함한 상태
                    이력 추가, 비활성 상태 전환 시 모든 리프레시 토큰 폐기를 하나의 트랜잭션으로
                    처리한다. 커밋 후 현재 상태에 따라 Redis 검색 인덱스를 추가 또는 제거한다.
                    관리자가 자기 계정을 비활성화하는 요청은 거부한다.
                    """
    )
    public ApiResponse<AdminDtos.AccountStatusResponse> changeStatus(
            @PathVariable Integer userSeq,
            @Valid @RequestBody AdminDtos.AccountStatusRequest request
    ) {
        return ApiResponse.of(adminService.changeAccountStatus(
                userSeq,
                SecurityUtils.currentUserSeq(),
                request
        ));
    }

    @PatchMapping("/reports/{reportSeq}")
    @Operation(
            summary = "게시물 신고 승인·기각",
            description = """
                    신고 행을 FOR UPDATE로 잠근 뒤 PENDING인지 확인한다. 처리 상태와 관리자 메모를
                    기록하고 ACCEPTED이면 연결된 게시물을 HIDDEN으로 전환한다. 신고 처리와 게시물
                    비노출은 같은 트랜잭션이므로 어느 한쪽만 반영되지 않는다.
                    """
    )
    public ApiResponse<Boolean> decideReport(
            @PathVariable Long reportSeq,
            @Valid @RequestBody AdminDtos.ReportDecision request
    ) {
        adminService.decideReport(reportSeq, SecurityUtils.currentUserSeq(), request);
        return ApiResponse.of(true);
    }
}
