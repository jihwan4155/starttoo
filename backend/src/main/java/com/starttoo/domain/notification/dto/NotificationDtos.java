package com.starttoo.domain.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class NotificationDtos {
    private NotificationDtos() {}

    public record NotificationItem(
            @Schema(description = "SYSTEM이면 해당 알림 ID, NEW_DM이면 방의 최신 알림 ID", example = "12005")
            Long notificationId,
            @Schema(allowableValues = {"NEW_DM", "SYSTEM"}, example = "NEW_DM")
            String notificationType,
            @Schema(description = "알림 행의 actor_id. NEW_DM에서는 최신 메시지 발신자 ID", example = "202")
            Long actorId,
            @Schema(description = "참조 리소스 종류", allowableValues = {"DM_ROOM", "REPORT", "ARTIST"}, example = "DM_ROOM")
            String referenceType,
            @Schema(description = "참조 리소스 ID. NEW_DM에서는 dmRoomId", example = "1001")
            Long referenceId,
            @Schema(description = "NEW_DM은 같은 방의 미확인 알림 수, SYSTEM은 1", example = "3")
            long count,
            @Schema(example = "새 메시지가 도착했습니다.")
            String title,
            @Schema(example = "가능합니다.")
            String body,
            @Schema(description = "SYSTEM 생성 시각 또는 DM 방의 최신 알림 생성 시각")
            Instant createdAt
    ) {
    }

    public record UnreadCountsResponse(
            @Schema(description = "그룹화 전 실제 미확인 알림 행의 총개수", example = "7")
            long totalCount,
            @Schema(description = "알림 타입별 미확인 행 개수", example = "{\"NEW_DM\":5,\"SYSTEM\":2}")
            Map<String, Long> counts
    ) {
    }

    public record NotificationPreview(
            List<NotificationItem> items,
            @Schema(description = "그룹화 전 실제 미확인 알림 행의 총개수", example = "7")
            long unreadCount
    ) {
    }

    public record NotificationPage(
            List<NotificationItem> items, String nextCursor, boolean hasNext, long unreadCount
    ) {
    }

    public record DmRoomMuteResponse(
            Long dmRoomId,
            boolean notificationMuted,
            Instant updatedAt
    ) {
    }
}
