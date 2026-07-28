package com.starttoo.common.pagination;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;

import java.math.BigDecimal;
import java.util.Map;

public final class CursorValues {

    private CursorValues() {
    }

    public static long longValue(Map<String, Object> cursor, String name, long defaultValue) {
        Object value = cursor.get(name);
        if (value == null) return defaultValue;
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (RuntimeException exception) {
            throw new BusinessException(ErrorCode.INVALID_CURSOR);
        }
    }

    public static BigDecimal decimalValue(Map<String, Object> cursor, String name) {
        Object value = cursor.get(name);
        if (value == null) return null;
        try {
            return new BigDecimal(value.toString());
        } catch (RuntimeException exception) {
            throw new BusinessException(ErrorCode.INVALID_CURSOR);
        }
    }
}
