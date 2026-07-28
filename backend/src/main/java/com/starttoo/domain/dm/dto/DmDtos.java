package com.starttoo.domain.dm.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class DmDtos {
    private DmDtos() {}
    public record Opponent(Long userId, String nickname, String profileImageUrl, String role) {}
    public record Message(
            Long dmMessageId, Long dmRoomId, Long senderId, String messageType,
            String textContent, String imageUrl, Instant readAt, Instant createdAt
    ) {}
    public record Room(
            Long dmRoomId, Opponent opponent, boolean active, Message lastMessage,
            long unreadCount, boolean notificationMuted, Instant lastMessageAt, Instant createdAt
    ) {}
    public record CreateRoomRequest(
            @NotNull @Schema(description = "1:1 채팅 상대 회원 ID", example = "202") Long otherUserId
    ) {}
    public record SendMessageRequest(
            @NotBlank @Schema(description = "메시지 유형", allowableValues = {"TEXT", "IMAGE", "TEXT_WITH_IMAGE"}, example = "TEXT") String messageType,
            @Size(max=10000) @Schema(description = "TEXT 또는 TEXT_WITH_IMAGE 메시지 내용", example = "안녕하세요.") String textContent,
            @Schema(description = "IMAGE 또는 TEXT_WITH_IMAGE에서 사용할 업로드 완료 objectKey", example = "dm/101/uuid.webp") String imageObjectKey
    ) {}
    public record ReadRequest(
            @NotNull @Schema(description = "이 메시지까지 읽음 처리할 같은 채팅방의 메시지 ID", example = "901") Long lastReadMessageId
    ) {}
}
