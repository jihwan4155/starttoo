package com.starttoo.common.exception;

public class FeatureNotImplementedException extends BusinessException {

    public FeatureNotImplementedException() {
        super(ErrorCode.FEATURE_NOT_IMPLEMENTED);
    }
}
