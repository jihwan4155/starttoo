package com.starttoo.common.exception;

import com.starttoo.common.api.ApiErrorResponse;
import com.starttoo.common.api.FieldErrorDetail;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(FieldBusinessException.class)
    public ResponseEntity<ApiErrorResponse> handleFieldBusinessException(
            FieldBusinessException exception
    ) {
        ErrorCode errorCode = exception.getErrorCode();
        return ResponseEntity.status(errorCode.getStatus()).body(new ApiErrorResponse(
                errorCode.getStatus().value(),
                errorCode.getCode(),
                exception.getMessage(),
                exception.getErrors()
        ));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> handleBusinessException(BusinessException exception) {
        ErrorCode errorCode = exception.getErrorCode();
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiErrorResponse.of(
                        errorCode.getStatus().value(),
                        errorCode.getCode(),
                        exception.getMessage()
                ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception
    ) {
        List<FieldErrorDetail> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldErrorDetail(error.getField(), error.getDefaultMessage()))
                .toList();

        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                400,
                ErrorCode.INVALID_REQUEST.getCode(),
                ErrorCode.INVALID_REQUEST.getMessage(),
                errors
        ));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
            ConstraintViolationException exception
    ) {
        List<FieldErrorDetail> errors = exception.getConstraintViolations().stream()
                .map(violation -> new FieldErrorDetail(
                        violation.getPropertyPath().toString(),
                        violation.getMessage()
                ))
                .toList();

        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                400,
                ErrorCode.INVALID_REQUEST.getCode(),
                ErrorCode.INVALID_REQUEST.getMessage(),
                errors
        ));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiErrorResponse> handleBadRequest(Exception exception) {
        return ResponseEntity.badRequest().body(ApiErrorResponse.of(
                400,
                ErrorCode.INVALID_REQUEST.getCode(),
                exception.getMessage() == null ? ErrorCode.INVALID_REQUEST.getMessage() : exception.getMessage()
        ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrityViolation(
            DataIntegrityViolationException exception
    ) {
        log.warn("Data integrity violation", exception);
        ErrorCode errorCode = ErrorCode.DATA_INTEGRITY_VIOLATION;
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiErrorResponse.of(
                        errorCode.getStatus().value(),
                        errorCode.getCode(),
                        errorCode.getMessage()
                ));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException exception) {
        ErrorCode errorCode = ErrorCode.FORBIDDEN;
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiErrorResponse.of(
                        errorCode.getStatus().value(),
                        errorCode.getCode(),
                        errorCode.getMessage()
                ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
        log.error("Unexpected server error", exception);
        ErrorCode errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiErrorResponse.of(
                        errorCode.getStatus().value(),
                        errorCode.getCode(),
                        errorCode.getMessage()
                ));
    }
}
