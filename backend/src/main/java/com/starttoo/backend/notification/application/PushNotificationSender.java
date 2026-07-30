package com.starttoo.backend.notification.application;

import com.starttoo.backend.notification.api.NotificationDtos;

import java.util.List;

public interface PushNotificationSender {

    /**
     * 전송 결과에서 영구적으로 사용할 수 없는 토큰만 반환한다.
     * 일시적인 전송 오류는 토큰을 비활성화하지 않고 로그로 남긴다.
     */
    List<String> send(
            List<String> pushTokens,
            NotificationDtos.NotificationResponse notification
    );
}
