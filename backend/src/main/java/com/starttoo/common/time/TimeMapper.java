package com.starttoo.common.time;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public final class TimeMapper {

    private TimeMapper() {
    }

    public static Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}
