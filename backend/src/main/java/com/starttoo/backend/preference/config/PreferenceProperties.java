package com.starttoo.backend.preference.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.preference")
public record PreferenceProperties(
        double survey,
        double postLike,
        double postBookmark,
        double collection,
        double notInterested,
        double dwellShort,
        double dwellMedium,
        double dwellLong
) {
}
