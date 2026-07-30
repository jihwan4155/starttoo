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
            summary = "내 알림 목록",
            description = """
                    receiverSeq가 현재 회원인 알림을 notificationSeq 내림차순 커서로 조회한다.
                    현재 구현은 읽음·미읽음 알림을 모두 반환하며 각 항목의 read와 readDttm으로
                    상태를 구분한다.
                    """
    )
    public ApiResponse<CursorPageResponse<NotificationDtos.NotificationResponse>> list(
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size
    ) {
        return ApiResponse.of(notificationService.list(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @GetMapping("/unread-count")
    @Operation(
            summary = "읽지 않은 알림 수",
            description = "현재 회원의 read=false 알림 개수를 집계하여 반환한다."
    )
    public ApiResponse<NotificationDtos.UnreadCount> unreadCount() {
        return ApiResponse.of(new NotificationDtos.UnreadCount(
                notificationService.unreadCount(SecurityUtils.currentUserSeq())
        ));
    }

    @PatchMapping("/{notificationSeq}/read")
    @Operation(
            summary = "알림 한 건 읽음 처리",
            description = """
                    현재 회원이 수신한 알림인지 확인하고 read=true와 최초 readDttm을 기록한다.
                    다른 회원의 알림은 존재하지 않는 리소스처럼 처리하며 이미 읽은 알림은
                    현재 상태를 그대로 반환한다.
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
