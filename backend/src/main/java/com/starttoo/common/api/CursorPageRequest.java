package com.starttoo.common.api;

public record CursorPageRequest(
        String cursor,
        Integer size
) {
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;

    public int normalizedSize() {
        if (size == null) {
            return DEFAULT_SIZE;
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new IllegalArgumentException("size는 1 이상 50 이하여야 합니다.");
        }
        return size;
    }
}

