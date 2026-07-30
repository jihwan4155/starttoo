package com.starttoo.backend.dm;

import com.starttoo.backend.dm.application.DmService;
import com.starttoo.backend.dm.application.DmRealtimeEventPublisher;
import com.starttoo.backend.dm.domain.DmMessageRepository;
import com.starttoo.backend.dm.domain.DmRoom;
import com.starttoo.backend.dm.domain.DmRoomParticipantRepository;
import com.starttoo.backend.dm.domain.DmRoomRepository;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.user.application.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DmServiceTest {

    @Mock
    private DmRoomRepository roomRepository;

    @Mock
    private DmRoomParticipantRepository participantRepository;

    @Mock
    private DmMessageRepository messageRepository;

    @Mock
    private ImageRepository imageRepository;

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
    void markReadAlsoMarksRoomNotificationsWithSameTimestamp() {
        DmRoom room = mock(DmRoom.class);
        when(room.contains(7)).thenReturn(true);
        when(roomRepository.findById(31L)).thenReturn(Optional.of(room));
        when(messageRepository.markRoomRead(any(), any(), any())).thenReturn(3);

        int changed = dmService.markRead(7, 31L);

        ArgumentCaptor<OffsetDateTime> messageTime =
                ArgumentCaptor.forClass(OffsetDateTime.class);
        ArgumentCaptor<OffsetDateTime> notificationTime =
                ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(messageRepository).markRoomRead(
                org.mockito.ArgumentMatchers.eq(31L),
                org.mockito.ArgumentMatchers.eq(7),
                messageTime.capture()
        );
        verify(notificationService).readDmRoom(
                org.mockito.ArgumentMatchers.eq(7),
                org.mockito.ArgumentMatchers.eq(31L),
                notificationTime.capture()
        );
        assertThat(notificationTime.getValue()).isEqualTo(messageTime.getValue());
        assertThat(changed).isEqualTo(3);
    }
}
