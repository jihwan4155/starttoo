package com.starttoo.backend.notification.application;

import com.starttoo.backend.notification.api.NotificationDtos;

/**
 * 알림 행과 핵심 업무 데이터가 모두 커밋된 뒤 실시간·푸시 전달에 사용한다.
 */
public record NotificationCreatedEvent(
        Integer receiverSeq,
        NotificationDtos.NotificationResponse notification
) {
}
