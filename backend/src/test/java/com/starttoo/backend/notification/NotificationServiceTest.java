package com.starttoo.backend.notification;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
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

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void listReturnsOnlyUnreadTopTenWithStableCursor() {
        List<Long> ids = LongStream.rangeClosed(1, 11)
                .map(value -> 12 - value)
                .boxed()
                .toList();
        List<Notification> notifications = ids.stream()
                .map(this::notification)
                .toList();
        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                any(Object[].class)
        )).thenReturn(ids);
        when(notificationRepository.findAllById(any())).thenReturn(notifications);

        CursorPageResponse<NotificationDtos.NotificationResponse> page =
                notificationService.list(7, null, 10);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).queryForList(
                sql.capture(),
                eq(Long.class),
                args.capture()
        );
        assertThat(sql.getValue()).contains(
                "is_read = FALSE",
                "ORDER BY notification_seq DESC"
        );
        assertThat(args.getValue()).containsExactly(7, null, null, 11);
        assertThat(page.items()).hasSize(10);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo("2");
    }

    @Test
    void listReturnsEmptyItemsWhenNoUnreadNotificationExists() {
        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                any(Object[].class)
        )).thenReturn(List.of());
        when(notificationRepository.findAllById(any())).thenReturn(List.of());

        CursorPageResponse<NotificationDtos.NotificationResponse> page =
                notificationService.list(7, null, 30);

        assertThat(page.items()).isEmpty();
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void unreadCountsIncludeEveryTypeAndTotalMatchesTypeSum() throws Exception {
        doAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(
                    mapper.mapRow(countRow("POST_LIKE", 4L), 0),
                    mapper.mapRow(countRow("NEW_DM", 3L), 1)
            );
        }).when(jdbcTemplate).query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );

        NotificationDtos.UnreadCounts counts = notificationService.unreadCounts(7);

        assertThat(counts.total()).isEqualTo(7L);
        assertThat(counts.byType()).hasSize(NotificationType.values().length);
        assertThat(counts.byType().get(NotificationType.POST_LIKE)).isEqualTo(4L);
        assertThat(counts.byType().get(NotificationType.NEW_DM)).isEqualTo(3L);
        assertThat(counts.byType().get(NotificationType.SYSTEM)).isZero();
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
    void readIsIdempotentForOwnerAndKeepsFirstReadTimestamp() {
        Notification notification = notification(31L);
        when(notificationRepository.findByNotificationSeqAndReceiverSeq(31L, 7))
                .thenReturn(Optional.of(notification));

        notificationService.read(7, 31L);
        OffsetDateTime firstReadDttm = notification.getReadDttm();
        notificationService.read(7, 31L);

        assertThat(notification.isRead()).isTrue();
        assertThat(notification.getReadDttm()).isEqualTo(firstReadDttm);
    }

    @Test
    void readReturnsNotFoundForAnotherUsersNotification() {
        when(notificationRepository.findByNotificationSeqAndReceiverSeq(31L, 7))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.read(7, 31L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
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
                .notificationType(NotificationType.POST_LIKE)
                .referenceSeq(101L)
                .title("게시글 좋아요")
                .body("게시글을 좋아합니다.")
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
