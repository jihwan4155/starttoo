package com.starttoo.domain.notification.controller;

import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.notification.dto.NotificationDtos.NotificationPage;
import com.starttoo.domain.notification.dto.NotificationDtos.NotificationPreview;
import com.starttoo.domain.notification.dto.NotificationDtos.UnreadCountsResponse;
import com.starttoo.domain.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@Tag(name="Notifications", description="읽지 않은 알림과 읽음 처리")
@SecurityRequirement(name="bearerAuth")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary="미확인 알림 타입별 개수", description="로그인 회원의 NEW_DM, SYSTEM 미확인 알림 행 개수를 반환합니다.")
    @GetMapping("/unread-counts")
    public UnreadCountsResponse unreadCounts() {
        return notificationService.unreadCounts(authenticationFacade.requireUserId());
    }

    @Operation(summary="미확인 알림 Top 10", description="SYSTEM은 개별 알림, NEW_DM은 DM 방별로 묶어 최신 그룹 10개를 반환합니다.")
    @GetMapping("/unread/preview")
    public NotificationPreview preview() {
        return notificationService.preview(authenticationFacade.requireUserId());
    }

    @Operation(summary="미확인 알림 전체 목록", description="SYSTEM은 개별 알림, NEW_DM은 DM 방별로 묶어 최신순 커서 페이지로 반환합니다.")
    @GetMapping("/unread")
    public NotificationPage unread(@RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        return notificationService.unread(authenticationFacade.requireUserId(), cursor, size);
    }
    @Operation(summary="개별 알림 읽음")
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> read(@PathVariable Long notificationId) {
        notificationService.read(authenticationFacade.requireUserId(), notificationId);
        return ResponseEntity.noContent().build();
    }
    @Operation(summary="전체 알림 읽음")
    @PatchMapping("/read-all")
    public ResponseEntity<Void> readAll() {
        notificationService.readAll(authenticationFacade.requireUserId());
        return ResponseEntity.noContent().build();
    }
}
