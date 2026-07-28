package com.starttoo.domain.dm.service;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.common.pagination.CursorValues;
import com.starttoo.domain.dm.dto.DmDtos.*;
import com.starttoo.domain.dm.entity.*;
import com.starttoo.domain.dm.repository.*;
import com.starttoo.domain.image.service.ObjectStoragePort;
import com.starttoo.domain.notification.service.NotificationService;
import com.starttoo.domain.social.repository.UserBlockRepository;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.Map;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class DmService {
    private final DmRoomRepository roomRepository;
    private final DmRoomParticipantRepository participantRepository;
    private final DmMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final UserBlockRepository blockRepository;
    private final NotificationService notificationService;
    private final ObjectStoragePort objectStoragePort;
    private final CursorCodec cursorCodec;
    private final Clock clock = Clock.systemUTC();

    @Transactional(readOnly=true)
    public CursorPageResponse<Room> rooms(Long userId, String cursor, int size) {
        long pageNumber = CursorValues.longValue(cursorCodec.decode(cursor), "page", 0);
        var slice = participantRepository.findActiveRooms(userId, PageRequest.of((int)pageNumber, size));
        var rows = slice.getContent().stream()
                .filter(p -> {
                    var room = roomRepository.findById(p.getId().getDmRoomId()).orElse(null);
                    return room != null && !blockRepository.existsEitherDirection(userId, opponentId(room, userId));
                }).toList();
        boolean hasNext = slice.hasNext();
        var page = rows;
        var items = page.stream().map(p -> roomResponse(userId, p)).toList();
        String next = hasNext ? cursorCodec.encode(Map.of("page", pageNumber + 1)) : null;
        return new CursorPageResponse<>(items, next, hasNext);
    }

    @Transactional
    public RoomCreation enter(Long userId, Long otherId) {
        if (userId.equals(otherId)) throw new BusinessException(ErrorCode.CANNOT_DM_SELF);
        userRepository.findById(otherId).filter(u -> "ACTIVE".equals(u.getAccountStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        if (blockRepository.existsEitherDirection(userId, otherId)) throw new BusinessException(ErrorCode.DM_BLOCKED);
        Long user1 = Math.min(userId, otherId), user2 = Math.max(userId, otherId);
        var existing = roomRepository.findBetween(user1, user2);
        boolean created = existing.isEmpty();
        var room = existing.orElseGet(() -> roomRepository.saveAndFlush(DmRoomEntity.builder().user1Id(user1).user2Id(user2).build()));
        if (created) {
            participantRepository.save(DmRoomParticipantEntity.builder().id(new DmRoomParticipantId(room.getDmRoomId(), user1)).build());
            participantRepository.save(DmRoomParticipantEntity.builder().id(new DmRoomParticipantId(room.getDmRoomId(), user2)).build());
        } else {
            requireParticipant(room.getDmRoomId(), userId).reactivate();
        }
        return new RoomCreation(created, roomResponse(userId, requireParticipant(room.getDmRoomId(), userId)));
    }

    @Transactional
    public void leave(Long userId, Long roomId) {
        requireRoom(roomId);
        var participant = requireParticipant(roomId, userId);
        Long last = messageRepository.findTopByDmRoomIdOrderByDmMessageIdDesc(roomId).map(DmMessageEntity::getDmMessageId).orElse(null);
        Long boundary = participant.getLastHiddenMessageId();
        if (last != null && (boundary == null || last > boundary)) boundary = last;
        participant.leave(boundary, now());
    }

    @Transactional(readOnly=true)
    public CursorPageResponse<Message> messages(Long userId, Long roomId, String cursor, int size) {
        requireRoom(roomId);
        var participant = requireParticipant(roomId, userId);
        long hidden = participant.getLastHiddenMessageId() == null ? 0 : participant.getLastHiddenMessageId();
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "beforeMessageId", Long.MAX_VALUE);
        var rows = messageRepository.findAllByDmRoomIdAndDmMessageIdGreaterThanAndDmMessageIdLessThanOrderByDmMessageIdDesc(
                roomId, hidden, before, PageRequest.of(0, size + 1));
        boolean hasNext = rows.size() > size;
        var page = new java.util.ArrayList<>(rows.subList(0, Math.min(size, rows.size())));
        Long nextId = page.isEmpty() ? null : page.getLast().getDmMessageId();
        Collections.reverse(page);
        return new CursorPageResponse<>(page.stream().map(this::messageResponse).toList(),
                hasNext ? cursorCodec.encode(Map.of("beforeMessageId", nextId)) : null, hasNext);
    }

    @Transactional
    public Message send(Long userId, Long roomId, SendMessageRequest request) {
        var room = requireRoom(roomId);
        requireParticipant(roomId, userId);
        Long otherId = opponentId(room, userId);
        if (blockRepository.existsEitherDirection(userId, otherId)) throw new BusinessException(ErrorCode.DM_BLOCKED);
        validateContent(request);
        if (request.imageObjectKey() != null) {
            objectStoragePort.verifyUploadedObject(request.imageObjectKey(), userId);
        }
        var value = messageRepository.saveAndFlush(DmMessageEntity.builder().dmRoomId(roomId).senderId(userId)
                .messageType(request.messageType()).textContent(request.textContent()).imageKey(request.imageObjectKey()).build());
        room.touch(now());
        requireParticipant(roomId, userId).reactivate();
        requireParticipant(roomId, otherId).reactivate();
        notificationService.createNewDm(otherId, userId, roomId, preview(request));
        return messageResponse(value);
    }

    @Transactional
    public void read(Long userId, Long roomId, Long lastReadId) {
        requireRoom(roomId);
        var participant = requireParticipant(roomId, userId);
        var last = messageRepository.findById(lastReadId).orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));
        if (!last.getDmRoomId().equals(roomId)) throw new BusinessException(ErrorCode.MESSAGE_ROOM_MISMATCH);
        long hidden = participant.getLastHiddenMessageId() == null ? 0 : participant.getLastHiddenMessageId();
        LocalDateTime now = now();
        messageRepository.findAllByDmRoomIdAndSenderIdNotAndReadAtIsNullAndDmMessageIdLessThanEqual(roomId, userId, lastReadId)
                .stream().filter(message -> message.getDmMessageId() > hidden).forEach(message -> message.markRead(now));
        notificationService.readRoom(userId, roomId);
    }

    private Room roomResponse(Long userId, DmRoomParticipantEntity participant) {
        var room = requireRoom(participant.getId().getDmRoomId());
        Long opponentId = opponentId(room, userId);
        var opponent = userRepository.findById(opponentId).orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        long hidden = participant.getLastHiddenMessageId() == null ? 0 : participant.getLastHiddenMessageId();
        var last = messageRepository.findTopByDmRoomIdOrderByDmMessageIdDesc(room.getDmRoomId()).filter(m -> m.getDmMessageId() > hidden).orElse(null);
        long unread = messageRepository.countByDmRoomIdAndSenderIdNotAndReadAtIsNullAndDmMessageIdGreaterThan(room.getDmRoomId(), userId, hidden);
        return new Room(room.getDmRoomId(), new Opponent(opponentId, opponent.getNickname(),
                opponent.getProfileImageKey() == null ? null : objectStoragePort.createDownloadUrl(opponent.getProfileImageKey()), opponent.getRole()),
                participant.isActive(), last == null ? null : messageResponse(last), unread,
                notificationService.isRoomMuted(userId, room.getDmRoomId()),
                toInstant(room.getLastMessageAt()), toInstant(room.getCreatedAt()));
    }

    private Message messageResponse(DmMessageEntity value) {
        return new Message(value.getDmMessageId(), value.getDmRoomId(), value.getSenderId(), value.getMessageType(),
                value.isDeleted() ? null : value.getTextContent(), value.isDeleted() || value.getImageKey() == null ? null : objectStoragePort.createDownloadUrl(value.getImageKey()),
                toInstant(value.getReadAt()), toInstant(value.getCreatedAt()));
    }
    private void validateContent(SendMessageRequest r) {
        boolean text = r.textContent() != null && !r.textContent().isBlank();
        boolean image = r.imageObjectKey() != null && !r.imageObjectKey().isBlank();
        boolean valid = switch (r.messageType()) {
            case "TEXT" -> text && !image;
            case "IMAGE" -> !text && image;
            case "TEXT_WITH_IMAGE" -> text && image;
            default -> false;
        };
        if (!valid) throw new BusinessException(ErrorCode.INVALID_REQUEST, "메시지 유형과 내용 조합이 올바르지 않습니다.");
    }
    private String preview(SendMessageRequest request) {
        String text = request.textContent();
        if (text == null || text.isBlank()) {
            return "이미지를 보냈습니다.";
        }
        int codePointCount = text.codePointCount(0, text.length());
        if (codePointCount <= 20) {
            return text;
        }
        int endIndex = text.offsetByCodePoints(0, 20);
        return text.substring(0, endIndex) + "...";
    }
    private DmRoomEntity requireRoom(Long id) { return roomRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.DM_ROOM_NOT_FOUND)); }
    private DmRoomParticipantEntity requireParticipant(Long roomId, Long userId) { return participantRepository.findById(new DmRoomParticipantId(roomId, userId)).orElseThrow(() -> new BusinessException(ErrorCode.NOT_DM_PARTICIPANT)); }
    private Long opponentId(DmRoomEntity room, Long userId) { return room.getUser1Id().equals(userId) ? room.getUser2Id() : room.getUser1Id(); }
    private LocalDateTime now() { return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC); }
    public record RoomCreation(boolean created, Room room) {}
}
