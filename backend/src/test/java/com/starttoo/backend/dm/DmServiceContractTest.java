package com.starttoo.backend.dm;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.dm.api.DmDtos;
import com.starttoo.backend.dm.application.DmRealtimeEventPublisher;
import com.starttoo.backend.dm.application.DmService;
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
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DmServiceContractTest {

    @Mock
    private DmRoomRepository roomRepository;

    @Mock
    private DmRoomParticipantRepository participantRepository;

    @Mock
    private DmMessageRepository messageRepository;

    @Mock
    private ImageRepository imageRepository;

    @Mock
    private MediaService mediaService;

    @Mock
    private UserService userService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private DmRealtimeEventPublisher realtimeEventPublisher;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private DmService dmService;

    @Test
    void createRoomUsesConflictSafeInsertAndMarksMessagesAndNotificationsRead() throws Exception {
        DmRoomParticipant participant = participant(false, true, 10L);
        when(userService.find(8)).thenReturn(
                User.builder().accountStatus(AccountStatus.ACTIVE).build()
        );
        when(jdbcTemplate.queryForObject(
                contains("SELECT EXISTS"),
                eq(Boolean.class),
                eq(7), eq(8), eq(8), eq(7)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("INSERT INTO dm_rooms"),
                eq(Long.class),
                eq(7), eq(8)
        )).thenReturn(31L);
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room()));
        when(participantRepository.findByIdDmRoomSeqAndIdUserSeq(31L, 7))
                .thenReturn(Optional.of(participant));
        mockRoomDetails();

        dmService.createRoom(7, 8);

        ArgumentCaptor<String> insertSql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(
                insertSql.capture(),
                eq(Long.class),
                eq(7), eq(8)
        );
        assertThat(insertSql.getValue()).contains(
                "ON CONFLICT (user1_seq, user2_seq)",
                "RETURNING dm_room_seq"
        );
        verify(messageRepository).markRoomRead(eq(31L), eq(7), eq(10L), any());
        verify(notificationService).readDmRoom(eq(7), eq(31L), any());
        assertThat(participant.isActive()).isTrue();
    }

    @Test
    void createRoomRejectsInactivePartnerBeforeWritingRoom() {
        when(userService.find(8)).thenReturn(
                User.builder().accountStatus(AccountStatus.SUSPENDED).build()
        );

        assertThatThrownBy(() -> dmService.createRoom(7, 8))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.USER_NOT_FOUND);

        verify(jdbcTemplate, never()).update(anyString(), any(Object[].class));
        verify(roomRepository, never()).findById(any());
    }

    @Test
    void sendPersistsWithoutNotificationAndPublishesToBothUsers() {
        DmRoomParticipant sender = participant(true, true, null);
        DmRoomParticipant receiver = participant(false, false, null);
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room()));
        when(jdbcTemplate.queryForObject(
                contains("SELECT EXISTS"),
                eq(Boolean.class),
                eq(7), eq(8), eq(8), eq(7)
        )).thenReturn(false);
        when(participantRepository.findByIdDmRoomSeqAndIdUserSeq(eq(31L), anyInt()))
                .thenAnswer(invocation -> Optional.of(
                        invocation.<Integer>getArgument(1) == 7 ? sender : receiver
                ));
        when(messageRepository.save(any(DmMessage.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        DmDtos.MessageResponse response = dmService.send(
                7,
                31L,
                new DmDtos.SendMessageRequest("hello", null)
        );

        verify(messageRepository).save(any(DmMessage.class));
        verify(notificationService, never()).create(
                anyInt(), anyInt(), any(), any(), anyString(), anyString()
        );
        verify(realtimeEventPublisher).messageCreated(8, response);
        verify(realtimeEventPublisher).messageCreated(7, response);
        assertThat(receiver.isActive()).isTrue();
    }

    @Test
    void sendRejectsBlockedPartnerBeforeSavingMessage() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room()));
        when(jdbcTemplate.queryForObject(
                contains("SELECT EXISTS"),
                eq(Boolean.class),
                eq(7), eq(8), eq(8), eq(7)
        )).thenReturn(true);

        assertThatThrownBy(() -> dmService.send(
                7,
                31L,
                new DmDtos.SendMessageRequest("blocked", null)
        )).isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        verify(messageRepository, never()).save(any());
    }

    @Test
    void markReadPropagatesNotificationUpdateFailureBeforePublishingEvent() {
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room()));
        when(participantRepository.findByIdDmRoomSeqAndIdUserSeq(31L, 7))
                .thenReturn(Optional.of(participant(true, true, 10L)));
        when(messageRepository.markRoomRead(eq(31L), eq(7), eq(10L), any()))
                .thenReturn(2);
        when(notificationService.readDmRoom(eq(7), eq(31L), any()))
                .thenThrow(new IllegalStateException("notification update failed"));

        assertThatThrownBy(() -> dmService.markRead(7, 31L))
                .isInstanceOf(IllegalStateException.class);

        verify(realtimeEventPublisher, never()).messagesRead(
                anyInt(), any(), anyInt(), any(), anyInt()
        );
    }

    @Test
    void roomsUseStableLatestMessageCursorAndPresignPartnerProfile() throws Exception {
        OffsetDateTime latest = OffsetDateTime.parse("2026-07-30T12:00:00+09:00");
        when(mediaService.downloadUrl("users/8/profile.webp"))
                .thenReturn("https://minio.example/profile-presigned");
        doAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            ResultSet first = roomResultSet(31L, latest);
            ResultSet second = roomResultSet(30L, latest.minusMinutes(1));
            return List.of(mapper.mapRow(first, 0), mapper.mapRow(second, 1));
        }).when(jdbcTemplate).query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );

        CursorPageResponse<DmDtos.RoomResponse> page = dmService.rooms(7, null, 1);

        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
        assertThat(page.items()).singleElement().satisfies(room -> {
            assertThat(room.dmRoomSeq()).isEqualTo(31L);
            assertThat(room.partner().userSeq()).isEqualTo(8);
            assertThat(room.partner().profileImageSeq()).isEqualTo(51L);
            assertThat(room.partner().profileImageUrl())
                    .isEqualTo("https://minio.example/profile-presigned");
            assertThat(room.lastMessageDttm()).isEqualTo(latest);
        });
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(
                sql.capture(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
        assertThat(sql.getValue()).contains(
                "message.dm_message_seq > room.last_hidden_message_seq",
                "ORDER BY sort_dttm DESC, dm_room_seq DESC"
        );
    }

    @Test
    void messagesExcludeHiddenHistoryAndPresignImageObjectKey() {
        OffsetDateTime now = OffsetDateTime.now();
        DmMessage message = DmMessage.builder()
                .dmMessageSeq(12L)
                .dmRoomSeq(31L)
                .senderSeq(8)
                .messageType(DmMessageType.IMAGE)
                .imageSeq(41L)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(8)
                .deleted(false)
                .build();
        DmMessage deleted = DmMessage.builder()
                .dmMessageSeq(11L)
                .dmRoomSeq(31L)
                .senderSeq(8)
                .messageType(DmMessageType.TEXT_WITH_IMAGE)
                .textContent("deleted")
                .imageSeq(42L)
                .regDttm(now.minusSeconds(1))
                .modDttm(now)
                .modUsrSeq(8)
                .deleted(true)
                .build();
        Image image = Image.builder()
                .imageSeq(41L)
                .objectKey("users/8/dm-image.webp")
                .regUsrSeq(8)
                .deleted(false)
                .build();
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room()));
        when(participantRepository.findByIdDmRoomSeqAndIdUserSeq(31L, 7))
                .thenReturn(Optional.of(participant(true, true, 10L)));
        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                any(Object[].class)
        )).thenReturn(List.of(12L, 11L));
        when(messageRepository.findAllById(any())).thenReturn(List.of(message, deleted));
        when(imageRepository.findAllById(any())).thenReturn(List.of(image));
        when(mediaService.downloadUrl(image)).thenReturn("https://minio.example/presigned");

        CursorPageResponse<DmDtos.MessageResponse> page =
                dmService.messages(7, 31L, null, 30);

        ArgumentCaptor<String> query = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).queryForList(
                query.capture(),
                eq(Long.class),
                args.capture()
        );
        assertThat(query.getValue()).contains("dm_message_seq > ?");
        assertThat(args.getValue()).containsSequence(31L, null, null, 10L, 10L, 31);
        assertThat(page.items()).hasSize(2);
        assertThat(page.items().get(0).imageSeq()).isEqualTo(41L);
        assertThat(page.items().get(0).imageUrl())
                .isEqualTo("https://minio.example/presigned");
        assertThat(page.items().get(1).textContent()).isNull();
        assertThat(page.items().get(1).imageSeq()).isNull();
        assertThat(page.items().get(1).imageUrl()).isNull();
        verify(mediaService).downloadUrl(image);
    }

    private DmRoom room() {
        return DmRoom.builder()
                .dmRoomSeq(31L)
                .user1Seq(7)
                .user2Seq(8)
                .regDttm(OffsetDateTime.now())
                .build();
    }

    private DmRoomParticipant participant(
            boolean active,
            boolean notificationEnabled,
            Long lastHiddenMessageSeq
    ) {
        return DmRoomParticipant.builder()
                .active(active)
                .notificationEnabled(notificationEnabled)
                .lastHiddenMessageSeq(lastHiddenMessageSeq)
                .build();
    }

    private void mockRoomDetails() throws Exception {
        doAnswer(invocation -> {
            ResultSet resultSet = org.mockito.Mockito.mock(ResultSet.class);
            when(resultSet.getString("nickname")).thenReturn("partner");
            when(resultSet.getLong("unread_count")).thenReturn(0L);
            RowMapper<?> mapper = invocation.getArgument(1);
            return mapper.mapRow(resultSet, 0);
        }).when(jdbcTemplate).queryForObject(
                contains("FROM users partner"),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
    }

    private ResultSet roomResultSet(Long roomSeq, OffsetDateTime latest) throws Exception {
        ResultSet resultSet = org.mockito.Mockito.mock(ResultSet.class);
        when(resultSet.getLong("dm_room_seq")).thenReturn(roomSeq);
        when(resultSet.getInt("partner_seq")).thenReturn(8);
        when(resultSet.getString("partner_nickname")).thenReturn("partner");
        when(resultSet.getObject("profile_image_seq", Long.class)).thenReturn(51L);
        when(resultSet.getString("profile_object_key")).thenReturn("users/8/profile.webp");
        when(resultSet.getBoolean("is_active")).thenReturn(true);
        when(resultSet.getBoolean("is_notification_enabled")).thenReturn(true);
        when(resultSet.getBoolean("partner_verified")).thenReturn(false);
        when(resultSet.getLong("unread_count")).thenReturn(1L);
        when(resultSet.getString("last_message_preview")).thenReturn("latest");
        when(resultSet.getObject("last_message_dttm", OffsetDateTime.class))
                .thenReturn(latest);
        when(resultSet.getObject("sort_dttm", OffsetDateTime.class)).thenReturn(latest);
        return resultSet;
    }
}
