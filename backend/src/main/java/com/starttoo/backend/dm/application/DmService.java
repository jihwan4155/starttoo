package com.starttoo.backend.dm.application;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.dm.api.DmDtos;
import com.starttoo.backend.dm.domain.DmMessage;
import com.starttoo.backend.dm.domain.DmMessageRepository;
import com.starttoo.backend.dm.domain.DmMessageType;
import com.starttoo.backend.dm.domain.DmRoom;
import com.starttoo.backend.dm.domain.DmRoomParticipant;
import com.starttoo.backend.dm.domain.DmRoomParticipantRepository;
import com.starttoo.backend.dm.domain.DmRoomRepository;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.NotificationType;
import com.starttoo.backend.user.application.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DmService {

    private final DmRoomRepository roomRepository;
    private final DmRoomParticipantRepository participantRepository;
    private final DmMessageRepository messageRepository;
    private final ImageRepository imageRepository;
    private final UserService userService;
    private final NotificationService notificationService;
    private final DmRealtimeEventPublisher realtimeEventPublisher;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public DmDtos.RoomResponse createRoom(Integer userSeq, Integer partnerSeq) {
        if (userSeq.equals(partnerSeq)) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        userService.find(partnerSeq);
        ensureNotBlocked(userSeq, partnerSeq);
        Integer user1 = Math.min(userSeq, partnerSeq);
        Integer user2 = Math.max(userSeq, partnerSeq);
        Long roomSeq = jdbcTemplate.queryForObject("""
                INSERT INTO dm_rooms (user1_seq, user2_seq)
                VALUES (?, ?)
                ON CONFLICT (user1_seq, user2_seq)
                DO UPDATE SET user1_seq = EXCLUDED.user1_seq
                RETURNING dm_room_seq
                """, Long.class, user1, user2);
        jdbcTemplate.update("""
                INSERT INTO dm_room_participants (dm_room_seq, user_seq)
                VALUES (?, ?), (?, ?)
                ON CONFLICT DO NOTHING
                """, roomSeq, user1, roomSeq, user2);
        DmRoom room = roomRepository.findById(roomSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.DM_ROOM_NOT_FOUND));
        participant(room.getDmRoomSeq(), userSeq).reactivate();
        return roomResponse(room, userSeq);
    }

    @Transactional(readOnly = true)
    public List<DmDtos.RoomResponse> rooms(Integer userSeq) {
        return jdbcTemplate.query("""
                WITH rooms_for_user AS (
                    SELECT r.dm_room_seq,
                           r.last_message_dttm,
                           p.is_active,
                           p.is_notification_enabled,
                           p.last_hidden_message_seq,
                           CASE WHEN r.user1_seq = ?
                                THEN r.user2_seq
                                ELSE r.user1_seq
                           END AS partner_seq
                      FROM dm_room_participants p
                      JOIN dm_rooms r ON r.dm_room_seq = p.dm_room_seq
                     WHERE p.user_seq = ?
                       AND p.is_active = TRUE
                )
                SELECT room.dm_room_seq,
                       room.partner_seq,
                       partner.nickname AS partner_nickname,
                       room.is_active,
                       room.is_notification_enabled,
                       room.last_message_dttm,
                       (
                           SELECT COUNT(*)
                             FROM dm_messages message
                            WHERE message.dm_room_seq = room.dm_room_seq
                              AND message.sender_seq <> ?
                              AND message.read_dttm IS NULL
                              AND message.is_deleted = FALSE
                              AND (
                                  room.last_hidden_message_seq IS NULL
                                  OR message.dm_message_seq > room.last_hidden_message_seq
                              )
                       ) AS unread_count,
                       (
                           SELECT CASE
                                      WHEN message.is_deleted THEN '삭제된 메시지'
                                      WHEN message.text_content IS NOT NULL
                                          THEN message.text_content
                                      ELSE '이미지'
                                  END
                             FROM dm_messages message
                            WHERE message.dm_room_seq = room.dm_room_seq
                              AND (
                                  room.last_hidden_message_seq IS NULL
                                  OR message.dm_message_seq > room.last_hidden_message_seq
                              )
                            ORDER BY message.dm_message_seq DESC
                            LIMIT 1
                       ) AS last_message_preview
                  FROM rooms_for_user room
                  JOIN users partner ON partner.user_seq = room.partner_seq
                 ORDER BY room.dm_room_seq DESC
                """, (rs, rowNum) -> new DmDtos.RoomResponse(
                rs.getLong("dm_room_seq"),
                rs.getInt("partner_seq"),
                rs.getString("partner_nickname"),
                rs.getBoolean("is_active"),
                rs.getBoolean("is_notification_enabled"),
                rs.getLong("unread_count"),
                rs.getString("last_message_preview"),
                rs.getObject("last_message_dttm", OffsetDateTime.class)
        ), userSeq, userSeq, userSeq);
    }

    @Transactional
    public DmDtos.MessageResponse send(
            Integer userSeq,
            Long roomSeq,
            DmDtos.SendMessageRequest request
    ) {
        DmRoom room = room(roomSeq, userSeq);
        Integer partnerSeq = room.partnerOf(userSeq);
        ensureNotBlocked(userSeq, partnerSeq);
        if (request.imageSeq() != null) {
            imageRepository.findByImageSeqAndDeletedFalse(request.imageSeq())
                    .filter(image -> image.getRegUsrSeq().equals(userSeq))
                    .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        }
        String text = request.textContent() == null || request.textContent().isBlank()
                ? null
                : request.textContent().trim();
        DmMessageType type = text != null && request.imageSeq() != null
                ? DmMessageType.TEXT_WITH_IMAGE
                : text != null ? DmMessageType.TEXT : DmMessageType.IMAGE;
        OffsetDateTime now = OffsetDateTime.now();
        DmMessage message = messageRepository.save(DmMessage.builder()
                .dmRoomSeq(roomSeq)
                .senderSeq(userSeq)
                .messageType(type)
                .textContent(text)
                .imageSeq(request.imageSeq())
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(userSeq)
                .deleted(false)
                .build());
        room.touchLastMessage();
        DmRoomParticipant senderParticipant = participant(roomSeq, userSeq);
        DmRoomParticipant receiverParticipant = participant(roomSeq, partnerSeq);
        senderParticipant.reactivate();
        receiverParticipant.reactivate();
        if (receiverParticipant.isNotificationEnabled()) {
            // 변경: NEW_DM 알림의 referenceSeq에는 방 식별자를 저장한다.
            notificationService.create(
                    partnerSeq,
                    userSeq,
                    NotificationType.NEW_DM,
                    roomSeq,
                    "새로운 DM이 도착했습니다.",
                    notificationBody(text)
            );
        }
        DmDtos.MessageResponse response = messageResponse(message);
        // 변경: 이벤트는 트랜잭션 안에서 등록하고 실제 전송은 AFTER_COMMIT에서 수행한다.
        realtimeEventPublisher.messageCreated(partnerSeq, response);
        return response;
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<DmDtos.MessageResponse> messages(
            Integer userSeq,
            Long roomSeq,
            Long cursor,
            int size
    ) {
        room(roomSeq, userSeq);
        DmRoomParticipant participant = participant(roomSeq, userSeq);
        int safeSize = Math.min(Math.max(size, 1), 100);
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT dm_message_seq
                  FROM dm_messages
                 WHERE dm_room_seq = ?
                   AND (CAST(? AS BIGINT) IS NULL OR dm_message_seq < ?)
                   AND (CAST(? AS BIGINT) IS NULL OR dm_message_seq > ?)
                 ORDER BY dm_message_seq DESC
                 LIMIT ?
                """, Long.class,
                roomSeq,
                cursor, cursor,
                participant.getLastHiddenMessageSeq(), participant.getLastHiddenMessageSeq(),
                safeSize + 1
        );
        boolean hasNext = ids.size() > safeSize;
        List<Long> page = hasNext ? ids.subList(0, safeSize) : ids;
        Map<Long, DmMessage> byId = new HashMap<>();
        messageRepository.findAllById(page)
                .forEach(value -> byId.put(value.getDmMessageSeq(), value));
        List<DmDtos.MessageResponse> items = page.stream()
                .map(id -> messageResponse(java.util.Objects.requireNonNull(byId.get(id))))
                .toList();
        String next = hasNext ? page.get(page.size() - 1).toString() : null;
        return CursorPageResponse.of(items, next, hasNext);
    }

    @Transactional
    public int markRead(Integer userSeq, Long roomSeq) {
        DmRoom room = room(roomSeq, userSeq);
        OffsetDateTime readDttm = OffsetDateTime.now();
        int changedMessages = messageRepository.markRoomRead(roomSeq, userSeq, readDttm);
        // 변경: 메시지 읽음과 같은 트랜잭션에서 해당 방의 NEW_DM 알림도 읽음 처리한다.
        int changedNotifications = notificationService.readDmRoom(userSeq, roomSeq, readDttm);
        if (changedMessages > 0 || changedNotifications > 0) {
            realtimeEventPublisher.messagesRead(
                    room.partnerOf(userSeq),
                    roomSeq,
                    userSeq,
                    readDttm,
                    changedMessages
            );
        }
        return changedMessages;
    }

    @Transactional
    public void leave(Integer userSeq, Long roomSeq) {
        room(roomSeq, userSeq);
        Long last = messageRepository.findTopByDmRoomSeqOrderByDmMessageSeqDesc(roomSeq)
                .map(DmMessage::getDmMessageSeq)
                .orElse(null);
        participant(roomSeq, userSeq).leave(last);
    }

    @Transactional
    public boolean notification(Integer userSeq, Long roomSeq, boolean enabled) {
        room(roomSeq, userSeq);
        participant(roomSeq, userSeq).changeNotification(enabled);
        return enabled;
    }

    @Transactional
    public void deleteMessage(Integer userSeq, Long roomSeq, Long messageSeq) {
        DmRoom room = room(roomSeq, userSeq);
        DmMessage message = messageRepository.findByDmMessageSeqAndDmRoomSeq(messageSeq, roomSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        if (!message.getSenderSeq().equals(userSeq)) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        message.delete(userSeq);
        realtimeEventPublisher.messageDeleted(room.partnerOf(userSeq), roomSeq, messageSeq);
    }

    private DmDtos.RoomResponse roomResponse(DmRoom room, Integer userSeq) {
        DmRoomParticipant participant = participant(room.getDmRoomSeq(), userSeq);
        Integer partnerSeq = room.partnerOf(userSeq);
        String nickname = jdbcTemplate.queryForObject(
                "SELECT nickname FROM users WHERE user_seq = ?",
                String.class,
                partnerSeq
        );
        Long unread = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                  FROM dm_messages
                 WHERE dm_room_seq = ?
                   AND sender_seq <> ?
                   AND read_dttm IS NULL
                   AND is_deleted = FALSE
                   AND (CAST(? AS BIGINT) IS NULL OR dm_message_seq > ?)
                """, Long.class,
                room.getDmRoomSeq(),
                userSeq,
                participant.getLastHiddenMessageSeq(),
                participant.getLastHiddenMessageSeq()
        );
        String preview = jdbcTemplate.query("""
                SELECT CASE WHEN is_deleted THEN '삭제된 메시지'
                            WHEN text_content IS NOT NULL THEN text_content
                            ELSE '이미지'
                       END
                  FROM dm_messages
                 WHERE dm_room_seq = ?
                   AND (CAST(? AS BIGINT) IS NULL OR dm_message_seq > ?)
                 ORDER BY dm_message_seq DESC
                 LIMIT 1
                """, rs -> rs.next() ? rs.getString(1) : null,
                room.getDmRoomSeq(),
                participant.getLastHiddenMessageSeq(),
                participant.getLastHiddenMessageSeq()
        );
        return new DmDtos.RoomResponse(
                room.getDmRoomSeq(),
                partnerSeq,
                nickname,
                participant.isActive(),
                participant.isNotificationEnabled(),
                unread == null ? 0 : unread,
                preview,
                room.getLastMessageDttm()
        );
    }

    private DmDtos.MessageResponse messageResponse(DmMessage message) {
        return new DmDtos.MessageResponse(
                message.getDmMessageSeq(),
                message.getDmRoomSeq(),
                message.getSenderSeq(),
                message.getMessageType(),
                message.isDeleted() ? null : message.getTextContent(),
                message.isDeleted() ? null : message.getImageSeq(),
                message.getReadDttm(),
                message.getRegDttm(),
                message.isDeleted()
        );
    }

    private String notificationBody(String text) {
        if (text == null) {
            return "이미지를 보냈습니다.";
        }
        if (text.length() <= 500) {
            return text;
        }
        return text.substring(0, 497) + "...";
    }

    private DmRoom room(Long roomSeq, Integer userSeq) {
        DmRoom room = roomRepository.findById(roomSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.DM_ROOM_NOT_FOUND));
        if (!room.contains(userSeq)) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        return room;
    }

    private DmRoomParticipant participant(Long roomSeq, Integer userSeq) {
        return participantRepository.findByIdDmRoomSeqAndIdUserSeq(roomSeq, userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.DM_ROOM_NOT_FOUND));
    }

    private void ensureNotBlocked(Integer first, Integer second) {
        boolean blocked = Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM user_blocks
                     WHERE (blocker_seq = ? AND blocked_seq = ?)
                        OR (blocker_seq = ? AND blocked_seq = ?)
                )
                """, Boolean.class, first, second, second, first));
        if (blocked) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
    }
}
