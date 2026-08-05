package com.starttoo.backend.notification;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.notification.api.NotificationDtos;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.notification.domain.Notification;
import com.starttoo.backend.notification.domain.NotificationRepository;
import com.starttoo.backend.notification.domain.NotificationType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private MediaService mediaService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void listGroupsAllUnreadDmByRoomBeforeOrderingAndPagination() throws Exception {
        OffsetDateTime regDttm = OffsetDateTime.parse("2026-07-30T01:30:00Z");
        doAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(2);
            ResultSet rs = org.mockito.Mockito.mock(ResultSet.class);
            when(rs.getLong("notification_seq")).thenReturn(81L);
            when(rs.getObject("actor_seq", Integer.class)).thenReturn(8);
            when(rs.getString("notification_type")).thenReturn("NEW_DM");
            when(rs.getObject("reference_seq", Long.class)).thenReturn(701L);
            when(rs.getString("title")).thenReturn("새 메시지");
            when(rs.getString("body")).thenReturn("상담 가능할까요?");
            when(rs.getObject("reg_dttm", OffsetDateTime.class)).thenReturn(regDttm);
            when(rs.getLong("unread_count")).thenReturn(4L);
            when(rs.getObject("partner_seq", Integer.class)).thenReturn(8);
            when(rs.getString("partner_nickname")).thenReturn("상대방");
            when(rs.getObject("partner_profile_image_seq", Long.class)).thenReturn(301L);
            when(rs.getString("partner_profile_object_key")).thenReturn("profiles/8.png");
            return List.of(mapper.mapRow(rs, 0));
        }).when(namedParameterJdbcTemplate).query(
                anyString(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        );
        when(mediaService.downloadUrl("profiles/8.png"))
                .thenReturn("https://temporary-profile-url");

        CursorPageResponse<NotificationDtos.NotificationResponse> page =
                notificationService.list(7, null, 10);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(namedParameterJdbcTemplate).query(
                sql.capture(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        );
        assertThat(sql.getValue()).contains(
                "COUNT(*) OVER",
                "PARTITION BY notification.reference_seq",
                "ROW_NUMBER() OVER",
                "UNION ALL",
                "ORDER BY item.reg_dttm DESC, item.notification_seq DESC"
        );
        assertThat(page.items()).singleElement().satisfies(item -> {
            assertThat(item.notificationSeq()).isEqualTo(81L);
            assertThat(item.unreadCount()).isEqualTo(4L);
            assertThat(item.partner().userSeq()).isEqualTo(8);
            assertThat(item.partner().profileImageUrl())
                    .isEqualTo("https://temporary-profile-url");
        });
    }

    @Test
    void unreadCountsUseRawNotificationRowsRatherThanGroupedRooms() throws Exception {
        doAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(
                    mapper.mapRow(countRow("NEW_DM", 5L), 0),
                    mapper.mapRow(countRow("SYSTEM", 2L), 1)
            );
        }).when(jdbcTemplate).query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );

        NotificationDtos.UnreadCounts counts = notificationService.unreadCounts(7);

        assertThat(counts.total()).isEqualTo(7L);
        assertThat(counts.byType()).hasSize(2);
        assertThat(counts.byType().get(NotificationType.NEW_DM)).isEqualTo(5L);
        assertThat(counts.byType().get(NotificationType.SYSTEM)).isEqualTo(2L);
        assertThat(counts.byType().values().stream()
                .mapToLong(Long::longValue)
                .sum()).isEqualTo(counts.total());
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(
                sql.capture(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );
        assertThat(sql.getValue()).contains(
                "is_read = FALSE",
                "GROUP BY notification_type"
        );
    }

    @Test
    void readingRepresentativeDmReadsEveryUnreadNotificationInRoom() {
        Notification notification = notification(81L);
        when(notificationRepository.findByNotificationSeqAndReceiverSeq(81L, 7))
                .thenReturn(Optional.of(notification));
        when(jdbcTemplate.queryForObject(
                contains("notification_type = 'NEW_DM'"),
                eq(Long.class),
                eq(7),
                eq(701L)
        )).thenReturn(4L);
        when(jdbcTemplate.query(
                contains("FROM dm_rooms room"),
                org.mockito.ArgumentMatchers.<RowMapper<NotificationDtos.NotificationPartner>>any(),
                eq(7), eq(701L), eq(7), eq(7)
        )).thenReturn(List.of(new NotificationDtos.NotificationPartner(
                8, "상대방", null, null, false
        )));

        NotificationDtos.NotificationResponse response = notificationService.read(7, 81L);

        assertThat(response.unreadCount()).isEqualTo(4L);
        assertThat(response.partner().userSeq()).isEqualTo(8);
        verify(notificationRepository).markDmRoomRead(
                eq(7), eq(701L), eq(NotificationType.NEW_DM), any(OffsetDateTime.class)
        );
    }

    @Test
    void readAllReturnsActualChangedRowCount() {
        when(notificationRepository.markAllRead(7)).thenReturn(5);

        assertThat(notificationService.readAll(7)).isEqualTo(5);
        verify(notificationRepository).markAllRead(7);
    }

    private Notification notification(Long notificationSeq) {
        return Notification.builder()
                .notificationSeq(notificationSeq)
                .receiverSeq(7)
                .actorSeq(8)
                .notificationType(NotificationType.NEW_DM)
                .referenceSeq(701L)
                .title("새 메시지")
                .body("상담 가능할까요?")
                .read(false)
                .regDttm(OffsetDateTime.now())
                .build();
    }

    private ResultSet countRow(String type, long count) throws Exception {
        ResultSet resultSet = org.mockito.Mockito.mock(ResultSet.class);
        when(resultSet.getString("notification_type")).thenReturn(type);
        when(resultSet.getLong("unread_count")).thenReturn(count);
        return resultSet;
    }
}
