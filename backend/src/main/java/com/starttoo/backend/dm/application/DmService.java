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
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.NotificationType;
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class DmService {

    private final DmRoomRepository roomRepository;
    private final DmRoomParticipantRepository participantRepository;
    private final DmMessageRepository messageRepository;
    private final ImageRepository imageRepository;
    private final MediaService mediaService;
    private final UserService userService;
    private final NotificationService notificationService;
    private final DmRealtimeEventPublisher realtimeEventPublisher;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public DmDtos.RoomResponse createRoom(Integer userSeq, Integer partnerSeq) {
        if (userSeq.equals(partnerSeq)) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        User partner = userService.find(partnerSeq);
        if (partner.getAccountStatus() != AccountStatus.ACTIVE) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
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
        DmRoomParticipant currentParticipant = participant(room.getDmRoomSeq(), userSeq);
        currentParticipant.reactivate();
        markVisibleMessagesRead(room, userSeq, currentParticipant);
        return roomResponse(room, userSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<DmDtos.RoomResponse> rooms(
            Integer userSeq,
            String cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        RoomCursor decoded = decodeRoomCursor(cursor);
        List<RoomRow> rows = jdbcTemplate.query("""
                WITH rooms_for_user AS (
                    SELECT r.dm_room_seq,
                           r.reg_dttm,
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
                ),
                room_details AS (
                    SELECT room.dm_room_seq,
                           room.partner_seq,
                           partner.nickname AS partner_nickname,
                           partner.profile_image_seq,
                           profile_image.object_key AS profile_object_key,
                           COALESCE(
                               partner.role = 'ARTIST'
                               AND artist.verification_status = 'VERIFIED',
                               FALSE
                           ) AS partner_verified,
                           room.is_active,
                           room.is_notification_enabled,
                           latest.last_message_preview,
                           latest.last_message_dttm,
                           COALESCE(latest.last_message_dttm, room.reg_dttm) AS sort_dttm,
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
                           ) AS unread_count
                      FROM rooms_for_user room
                      JOIN users partner ON partner.user_seq = room.partner_seq
                      LEFT JOIN images profile_image
                        ON profile_image.image_seq = partner.profile_image_seq
                       AND profile_image.is_deleted = FALSE
                      LEFT JOIN artists artist
                        ON artist.user_seq = partner.user_seq
                       AND artist.is_deleted = FALSE
                      LEFT JOIN LATERAL (
                          SELECT CASE
                                     WHEN message.is_deleted THEN '삭제된 메시지'
                                     WHEN message.text_content IS NOT NULL
                                         THEN message.text_content
                                     ELSE '이미지'
                                 END AS last_message_preview,
                                 message.reg_dttm AS last_message_dttm
                            FROM dm_messages message
                           WHERE message.dm_room_seq = room.dm_room_seq
                             AND (
                                 room.last_hidden_message_seq IS NULL
                                 OR message.dm_message_seq > room.last_hidden_message_seq
                             )
                           ORDER BY message.dm_message_seq DESC
                           LIMIT 1
                      ) latest ON TRUE
                )
                SELECT *
                  FROM room_details
                 WHERE (
                     CAST(? AS TIMESTAMPTZ) IS NULL
                     OR sort_dttm < CAST(? AS TIMESTAMPTZ)
                     OR (
                         sort_dttm = CAST(? AS TIMESTAMPTZ)
                         AND dm_room_seq < ?
                     )
                 )
                 ORDER BY sort_dttm DESC, dm_room_seq DESC
                 LIMIT ?
                """, (rs, rowNum) -> {
            DmDtos.RoomResponse response = new DmDtos.RoomResponse(
                    rs.getLong("dm_room_seq"),
                    new DmDtos.PartnerSummary(
                            rs.getInt("partner_seq"),
                            rs.getString("partner_nickname"),
                            rs.getObject("profile_image_seq", Long.class),
                            downloadUrl(rs.getString("profile_object_key")),
                            rs.getBoolean("partner_verified")
                    ),
                    rs.getBoolean("is_active"),
                    rs.getBoolean("is_notification_enabled"),
                    rs.getLong("unread_count"),
                    rs.getString("last_message_preview"),
                    rs.getObject("last_message_dttm", OffsetDateTime.class)
            );
            return new RoomRow(
                    rs.getObject("sort_dttm", OffsetDateTime.class),
                    rs.getLong("dm_room_seq"),
                    response
            );
        },
                userSeq, userSeq, userSeq,
                decoded == null ? null : decoded.sortDttm(),
                decoded == null ? null : decoded.sortDttm(),
                decoded == null ? null : decoded.sortDttm(),
                decoded == null ? null : decoded.roomSeq(),
                safeSize + 1
        );
        boolean hasNext = rows.size() > safeSize;
        List<RoomRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        List<DmDtos.RoomResponse> items = page.stream()
                .map(RoomRow::response)
                .toList();
        String nextCursor = hasNext
                ? encodeRoomCursor(page.get(page.size() - 1))
                : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
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
        Image attachedImage = null;
        if (request.imageSeq() != null) {
            attachedImage = imageRepository.findByImageSeqAndDeletedFalse(request.imageSeq())
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
        DmDtos.MessageResponse response = messageResponse(message, attachedImage);
        realtimeEventPublisher.messageCreated(partnerSeq, response);
        realtimeEventPublisher.messageCreated(userSeq, response);
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
        List<DmMessage> messages = page.stream()
                .map(id -> Objects.requireNonNull(byId.get(id)))
                .toList();
        List<DmDtos.MessageResponse> items = messageResponses(messages);
        String next = hasNext ? page.get(page.size() - 1).toString() : null;
        return CursorPageResponse.of(items, next, hasNext);
    }

    @Transactional
    public int markRead(Integer userSeq, Long roomSeq) {
        DmRoom room = room(roomSeq, userSeq);
        DmRoomParticipant currentParticipant = participant(roomSeq, userSeq);
        return markVisibleMessagesRead(room, userSeq, currentParticipant);
    }

    private int markVisibleMessagesRead(
            DmRoom room,
            Integer userSeq,
            DmRoomParticipant currentParticipant
    ) {
        OffsetDateTime readDttm = OffsetDateTime.now();
        int changedMessages = messageRepository.markRoomRead(
                room.getDmRoomSeq(),
                userSeq,
                currentParticipant.getLastHiddenMessageSeq(),
                readDttm
        );
        int changedNotifications = notificationService.readDmRoom(
                userSeq,
                room.getDmRoomSeq(),
                readDttm
        );
        if (changedMessages > 0 || changedNotifications > 0) {
            realtimeEventPublisher.messagesRead(
                    room.partnerOf(userSeq),
                    room.getDmRoomSeq(),
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

    private DmDtos.RoomResponse roomResponse(DmRoom room, Integer userSeq) {
        DmRoomParticipant participant = participant(room.getDmRoomSeq(), userSeq);
        Integer partnerSeq = room.partnerOf(userSeq);
        RoomDetails details = jdbcTemplate.queryForObject("""
                SELECT partner.nickname,
                       partner.profile_image_seq,
                       profile_image.object_key AS profile_object_key,
                       COALESCE(
                           partner.role = 'ARTIST'
                           AND artist.verification_status = 'VERIFIED',
                           FALSE
                       ) AS partner_verified,
                       (
                           SELECT COUNT(*)
                             FROM dm_messages message
                            WHERE message.dm_room_seq = ?
                              AND message.sender_seq <> ?
                              AND message.read_dttm IS NULL
                              AND message.is_deleted = FALSE
                              AND (CAST(? AS BIGINT) IS NULL OR message.dm_message_seq > ?)
                       ) AS unread_count,
                       latest.last_message_preview,
                       latest.last_message_dttm
                  FROM users partner
                  LEFT JOIN images profile_image
                    ON profile_image.image_seq = partner.profile_image_seq
                   AND profile_image.is_deleted = FALSE
                  LEFT JOIN artists artist
                    ON artist.user_seq = partner.user_seq
                   AND artist.is_deleted = FALSE
                  LEFT JOIN LATERAL (
                      SELECT CASE
                                 WHEN message.is_deleted THEN '삭제된 메시지'
                                 WHEN message.text_content IS NOT NULL THEN message.text_content
                                 ELSE '이미지'
                             END AS last_message_preview,
                             message.reg_dttm AS last_message_dttm
                        FROM dm_messages message
                       WHERE message.dm_room_seq = ?
                         AND (CAST(? AS BIGINT) IS NULL OR message.dm_message_seq > ?)
                       ORDER BY message.dm_message_seq DESC
                       LIMIT 1
                  ) latest ON TRUE
                 WHERE partner.user_seq = ?
                """, (rs, rowNum) -> new RoomDetails(
                rs.getString("nickname"),
                rs.getObject("profile_image_seq", Long.class),
                rs.getString("profile_object_key"),
                rs.getBoolean("partner_verified"),
                rs.getLong("unread_count"),
                rs.getString("last_message_preview"),
                rs.getObject("last_message_dttm", OffsetDateTime.class)
        ),
                room.getDmRoomSeq(),
                userSeq,
                participant.getLastHiddenMessageSeq(),
                participant.getLastHiddenMessageSeq(),
                room.getDmRoomSeq(),
                participant.getLastHiddenMessageSeq(),
                participant.getLastHiddenMessageSeq(),
                partnerSeq
        );
        Objects.requireNonNull(details);
        return new DmDtos.RoomResponse(
                room.getDmRoomSeq(),
                new DmDtos.PartnerSummary(
                        partnerSeq,
                        details.nickname(),
                        details.profileImageSeq(),
                        downloadUrl(details.profileObjectKey()),
                        details.partnerVerified()
                ),
                participant.isActive(),
                participant.isNotificationEnabled(),
                details.unreadCount(),
                details.lastMessagePreview(),
                details.lastMessageDttm()
        );
    }

    private List<DmDtos.MessageResponse> messageResponses(List<DmMessage> messages) {
        List<Long> imageSeqs = messages.stream()
                .filter(message -> !message.isDeleted())
                .map(DmMessage::getImageSeq)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Image> images = new HashMap<>();
        imageRepository.findAllById(imageSeqs).forEach(image -> {
            if (!image.isDeleted()) {
                images.put(image.getImageSeq(), image);
            }
        });
        return messages.stream()
                .map(message -> messageResponse(message, images.get(message.getImageSeq())))
                .toList();
    }

    private DmDtos.MessageResponse messageResponse(DmMessage message, Image image) {
        return new DmDtos.MessageResponse(
                message.getDmMessageSeq(),
                message.getDmRoomSeq(),
                message.getSenderSeq(),
                message.getMessageType(),
                message.isDeleted() ? null : message.getTextContent(),
                message.isDeleted() ? null : message.getImageSeq(),
                message.isDeleted() || image == null ? null : mediaService.downloadUrl(image),
                message.getReadDttm(),
                message.isDeleted(),
                message.getRegDttm()
        );
    }

    private String downloadUrl(String objectKey) {
        return objectKey == null ? null : mediaService.downloadUrl(objectKey);
    }

    private RoomCursor decodeRoomCursor(String cursor) {
        if (cursor == null) {
            return null;
        }
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(cursor),
                    StandardCharsets.UTF_8
            );
            String[] values = decoded.split("\\|", -1);
            if (values.length != 2) {
                throw BusinessException.of(ErrorCode.INVALID_CURSOR);
            }
            return new RoomCursor(
                    OffsetDateTime.parse(values[0]),
                    Long.parseLong(values[1])
            );
        } catch (RuntimeException exception) {
            throw BusinessException.of(ErrorCode.INVALID_CURSOR);
        }
    }

    private String encodeRoomCursor(RoomRow row) {
        String value = row.sortDttm() + "|" + row.roomSeq();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
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

    private record RoomRow(
            OffsetDateTime sortDttm,
            Long roomSeq,
            DmDtos.RoomResponse response
    ) {
    }

    private record RoomCursor(OffsetDateTime sortDttm, Long roomSeq) {
    }

    private record RoomDetails(
            String nickname,
            Long profileImageSeq,
            String profileObjectKey,
            boolean partnerVerified,
            long unreadCount,
            String lastMessagePreview,
            OffsetDateTime lastMessageDttm
    ) {
    }
}
