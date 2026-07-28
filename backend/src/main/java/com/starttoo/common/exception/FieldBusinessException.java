package com.starttoo.common.exception;

import com.starttoo.common.api.FieldErrorDetail;
import lombok.Getter;

import java.util.List;

@Getter
public class FieldBusinessException extends BusinessException {

    private final List<FieldErrorDetail> errors;

    public FieldBusinessException(ErrorCode errorCode, List<FieldErrorDetail> errors) {
        super(errorCode);
        this.errors = List.copyOf(errors);
    }
}

