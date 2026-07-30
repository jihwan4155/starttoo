package com.starttoo.backend.common.error;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingPathVariableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.sql.SQLException;
import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException exception) {
        ErrorCode code = exception.getErrorCode();
        return ResponseEntity
                .status(code.getHttpStatus())
                .body(ErrorResponse.of(code, exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception
    ) {
        List<ErrorResponse.FieldViolation> violations = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toViolation)
                .toList();
        return ResponseEntity.badRequest().body(ErrorResponse.of(
                ErrorCode.VALIDATION_ERROR,
                ErrorCode.VALIDATION_ERROR.getDefaultMessage(),
                violations
        ));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            ConstraintViolationException exception
    ) {
        List<ErrorResponse.FieldViolation> violations = exception.getConstraintViolations()
                .stream()
                .map(violation -> new ErrorResponse.FieldViolation(
                        violation.getPropertyPath().toString(),
                        violation.getInvalidValue(),
                        violation.getMessage()
                ))
                .toList();
        return ResponseEntity.badRequest().body(ErrorResponse.of(
                ErrorCode.VALIDATION_ERROR,
                ErrorCode.VALIDATION_ERROR.getDefaultMessage(),
                violations
        ));
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class,
            MissingPathVariableException.class,
            MethodArgumentTypeMismatchException.class,
            IllegalArgumentException.class
    })
    public ResponseEntity<ErrorResponse> handleBadRequest(Exception exception) {
        return ResponseEntity.badRequest().body(ErrorResponse.of(
                ErrorCode.INVALID_REQUEST,
                ErrorCode.INVALID_REQUEST.getDefaultMessage()
        ));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoResourceFoundException exception) {
        return ResponseEntity.status(ErrorCode.RESOURCE_NOT_FOUND.getHttpStatus())
                .body(ErrorResponse.of(
                        ErrorCode.RESOURCE_NOT_FOUND,
                        ErrorCode.RESOURCE_NOT_FOUND.getDefaultMessage()
                ));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleUnsupportedMediaType(
            HttpMediaTypeNotSupportedException exception
    ) {
        return ResponseEntity.status(ErrorCode.UNSUPPORTED_MEDIA_TYPE.getHttpStatus())
                .body(ErrorResponse.of(
                        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
                        ErrorCode.UNSUPPORTED_MEDIA_TYPE.getDefaultMessage()
                ));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(
            HttpRequestMethodNotSupportedException exception
    ) {
        return ResponseEntity.status(ErrorCode.METHOD_NOT_ALLOWED.getHttpStatus())
                .body(ErrorResponse.of(
                        ErrorCode.METHOD_NOT_ALLOWED,
                        ErrorCode.METHOD_NOT_ALLOWED.getDefaultMessage()
                ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException exception) {
        log.info("Database constraint violation", exception);
        SQLException sqlException = sqlException(exception);
        ErrorCode code = switch (sqlException == null ? "" : sqlException.getSQLState()) {
            case "23505" -> uniqueCode(sqlException.getMessage());
            case "23503" -> ErrorCode.STATE_CONFLICT;
            case "23514", "23502", "22001" -> ErrorCode.VALIDATION_ERROR;
            default -> ErrorCode.STATE_CONFLICT;
        };
        return ResponseEntity.status(code.getHttpStatus())
                .body(ErrorResponse.of(code, code.getDefaultMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception) {
        log.error("Unhandled server error", exception);
        return ResponseEntity.status(ErrorCode.INTERNAL_SERVER_ERROR.getHttpStatus())
                .body(ErrorResponse.of(
                        ErrorCode.INTERNAL_SERVER_ERROR,
                        ErrorCode.INTERNAL_SERVER_ERROR.getDefaultMessage()
                ));
    }

    private ErrorResponse.FieldViolation toViolation(FieldError error) {
        return new ErrorResponse.FieldViolation(
                error.getField(),
                error.getRejectedValue(),
                error.getDefaultMessage()
        );
    }

    private SQLException sqlException(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SQLException sql) {
                return sql;
            }
            current = current.getCause();
        }
        return null;
    }

    private ErrorCode uniqueCode(String message) {
        if (message == null) {
            return ErrorCode.DUPLICATE_RESOURCE;
        }
        if (message.contains("nickname")) {
            return ErrorCode.DUPLICATE_NICKNAME;
        }
        if (message.contains("phone_number")) {
            return ErrorCode.DUPLICATE_PHONE_NUMBER;
        }
        return ErrorCode.DUPLICATE_RESOURCE;
    }
}
