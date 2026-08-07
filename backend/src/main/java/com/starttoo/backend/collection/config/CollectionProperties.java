package com.starttoo.backend.collection.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 컬렉션·보관함 정책값.
 *
 * @param archiveMaxDesigns 한 회원이 보관함에 담을 수 있는 도안 수
 */
@ConfigurationProperties(prefix = "app.collection")
public record CollectionProperties(
        int archiveMaxDesigns
) {
}
