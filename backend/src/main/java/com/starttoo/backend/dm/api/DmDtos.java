package com.starttoo.backend.dm.api;

import com.starttoo.backend.dm.domain.DmMessageType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class DmDtos {

    private DmDtos() {
    }

    public record CreateRoomRequest(
            @Schema(description = "대화를 시작할 상대 회원 seq", example = "102")
            @NotNull Integer partnerSeq
    ) {
    }

    public record RoomResponse(
            Long dmRoomSeq,
            PartnerSummary partner,
            boolean active,
            boolean notificationEnabled,
            long unreadCount,
            String lastMessagePreview,
            OffsetDateTime lastMessageDttm
    ) {
    }

    public record PartnerSummary(
            Integer userSeq,
            String nickname,
            Long profileImageSeq,
            String profileImageUrl,
            @Schema(description = "role이 ARTIST이고 아티스트 인증이 완료된 경우 true")
            boolean verified
    ) {
    }

    public record SendMessageRequest(
            @Schema(description = "텍스트 본문. 이미지가 있으면 생략 가능", example = "상담 가능할까요?")
            @Size(max = 4000) String textContent,
            @Schema(description = "본인이 업로드한 이미지 seq. 텍스트가 있으면 생략 가능",
                    example = "301")
            Long imageSeq
    ) {
        @AssertTrue(message = "textContent 또는 imageSeq 중 하나 이상이 필요합니다.")
        public boolean hasContent() {
            return (textContent != null && !textContent.isBlank()) || imageSeq != null;
        }
    }

    public record MessageResponse(
            Long dmMessageSeq,
            Long dmRoomSeq,
            Integer senderSeq,
            DmMessageType messageType,
            String textContent,
            Long imageSeq,
            String imageUrl,
            OffsetDateTime readDttm,
            boolean deleted,
            OffsetDateTime regDttm
    ) {
    }

    public record NotificationSettingRequest(
            @Schema(description = "이 채팅방의 푸시 알림 수신 여부", example = "false")
            @NotNull Boolean enabled
    ) {
    }

    /**
     * `/user/queue/dm-events`에서 수신하는 실시간 이벤트 계약이다.
     * eventId와 dmMessageSeq를 이용하면 WebSocket 재연결·FCM 중복 상황에서도
     * 클라이언트가 동일 이벤트를 중복 표시하지 않을 수 있다.
     */
    public record RealtimeEvent(
            String eventId,
            RealtimeEventType eventType,
            Long dmRoomSeq,
            MessageResponse message,
            Integer readerSeq,
            OffsetDateTime readDttm,
            Integer changedMessageCount,
            OffsetDateTime occurredDttm
    ) {
        public static RealtimeEvent messageCreated(MessageResponse message) {
            return new RealtimeEvent(
                    UUID.randomUUID().toString(),
                    RealtimeEventType.MESSAGE_CREATED,
                    message.dmRoomSeq(),
                    message,
                    null,
                    null,
                    null,
                    OffsetDateTime.now()
            );
        }

        public static RealtimeEvent messagesRead(
                Long roomSeq,
                Integer readerSeq,
                OffsetDateTime readDttm,
                int changedMessageCount
        ) {
            return new RealtimeEvent(
                    UUID.randomUUID().toString(),
                    RealtimeEventType.MESSAGES_READ,
                    roomSeq,
                    null,
                    readerSeq,
                    readDttm,
                    changedMessageCount,
                    OffsetDateTime.now()
            );
        }
    }

    public enum RealtimeEventType {
        MESSAGE_CREATED,
        MESSAGES_READ
    }
}
