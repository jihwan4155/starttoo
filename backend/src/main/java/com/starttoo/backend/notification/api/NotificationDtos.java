package com.starttoo.backend.notification.api;

import com.starttoo.backend.notification.domain.NotificationType;

import java.time.OffsetDateTime;
import java.util.Map;
import io.swagger.v3.oas.annotations.media.Schema;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record NotificationResponse(
            Long notificationSeq,
            Integer actorSeq,
            NotificationType notificationType,
            Long referenceSeq,
            @Schema(description = "NEW_DM이면 상대 회원 정보, SYSTEM이면 null")
            NotificationPartner partner,
            @Schema(description = "NEW_DM 방의 미확인 알림 수. SYSTEM은 1", example = "4")
            long unreadCount,
            String title,
            String body,
            OffsetDateTime regDttm
    ) {
    }

    public record NotificationPartner(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            @Schema(description = "프로필 이미지의 단기 Presigned GET URL")
            String profileImageUrl,
            @Schema(description = "role이 ARTIST이고 아티스트 인증이 완료된 경우 true")
            boolean verified
    ) {
    }

    public record UnreadCounts(
            long total,
            Map<NotificationType, Long> byType
    ) {
    }
}
