package com.starttoo.backend.notification.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.notification.application.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "서비스 알림 조회와 읽음 처리")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(
            summary = "내 미확인 알림 목록",
            description = """
                    NEW_DM은 전체 미확인 알림에서 채팅방별로 집계하고 SYSTEM은 개별로 반환한다.
                    집계 대표값은 가장 최근 알림이며 대표 regDttm, notificationSeq 내림차순으로
                    정렬한 뒤 커서 페이지네이션한다. size=10은 미확인 알림 Top 10과 동일하다.
                    """
    )
    public ApiResponse<CursorPageResponse<NotificationDtos.NotificationResponse>> list(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size
    ) {
        return ApiResponse.of(notificationService.list(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @GetMapping("/unread-counts")
    @Operation(
            summary = "타입별 미확인 알림 수",
            description = """
                    현재 회원의 isRead=false 알림을 한 번의 GROUP BY 조회로 집계한다.
                    total은 byType 값의 합이며 알림이 없는 타입도 0으로 모두 포함한다.
                    """
    )
    public ApiResponse<NotificationDtos.UnreadCounts> unreadCounts() {
        return ApiResponse.of(notificationService.unreadCounts(
                SecurityUtils.currentUserSeq()
        ));
    }

    @PatchMapping("/{notificationSeq}/read")
    @Operation(
            summary = "알림 한 건 읽음 처리",
            description = """
                    SYSTEM은 지정한 한 건을 읽음 처리한다. NEW_DM 대표 알림은 같은 채팅방의
                    모든 미확인 NEW_DM 알림을 읽음 처리한다. DM 메시지 자체의 readDttm은
                    변경하지 않으며 다른 회원의 알림은 존재하지 않는 리소스처럼 처리한다.
                    """
    )
    public ApiResponse<NotificationDtos.NotificationResponse> read(
            @PathVariable Long notificationSeq
    ) {
        return ApiResponse.of(notificationService.read(
                SecurityUtils.currentUserSeq(),
                notificationSeq
        ));
    }

    @PatchMapping("/read-all")
    @Operation(
            summary = "내 알림 전체 읽음 처리",
            description = """
                    현재 회원의 read=false 알림을 한 번의 UPDATE로 모두 읽음 처리한다.
                    실제로 변경된 알림 행 수를 반환한다.
                    """
    )
    public ApiResponse<Integer> readAll() {
        return ApiResponse.of(notificationService.readAll(SecurityUtils.currentUserSeq()));
    }
}
