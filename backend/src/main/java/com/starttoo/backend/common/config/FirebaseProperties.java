package com.starttoo.backend.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * FCM 서버 연동 설정이다.
 *
 * <p>로컬에서는 enabled=false가 기본값이므로 Firebase 자격 증명 없이도 서버를
 * 실행할 수 있다. 운영에서 enabled=true로 전환할 때 credentialsPath 또는
 * Application Default Credentials를 제공해야 한다.</p>
 */
@ConfigurationProperties(prefix = "app.firebase")
public record FirebaseProperties(
        boolean enabled,
        String credentialsPath,
        String projectId
) {
}
