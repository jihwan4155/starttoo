package com.starttoo.backend.common.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식이 올바르지 않습니다."),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "입력값 검증에 실패했습니다."),
    INVALID_CURSOR(HttpStatus.BAD_REQUEST, "페이지 커서가 올바르지 않습니다."),
    INVALID_FILE(HttpStatus.BAD_REQUEST, "파일 형식 또는 크기가 올바르지 않습니다."),
    MASK_TOO_LARGE(HttpStatus.BAD_REQUEST, "그린 형태 데이터가 허용 범위를 초과했습니다."),
    INVALID_OAUTH_PROVIDER(HttpStatus.BAD_REQUEST, "지원하지 않는 OAuth 제공자입니다."),
    PHONE_VERIFICATION_REQUIRED(HttpStatus.BAD_REQUEST, "휴대폰 인증이 필요합니다."),
    PHONE_VERIFICATION_FAILED(HttpStatus.BAD_REQUEST, "휴대폰 인증 정보가 올바르지 않습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "토큰이 올바르지 않습니다."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "토큰이 만료되었습니다."),
    OAUTH_AUTHENTICATION_FAILED(HttpStatus.UNAUTHORIZED, "소셜 인증에 실패했습니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "요청한 작업을 수행할 권한이 없습니다."),
    ACCOUNT_SUSPENDED(HttpStatus.FORBIDDEN, "정지된 계정입니다."),
    ACCOUNT_BANNED(HttpStatus.FORBIDDEN, "강퇴된 계정입니다."),
    ACCOUNT_WITHDRAWN(HttpStatus.FORBIDDEN, "탈퇴한 계정입니다."),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."),
    ARTIST_NOT_FOUND(HttpStatus.NOT_FOUND, "아티스트를 찾을 수 없습니다."),
    IMAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "이미지를 찾을 수 없습니다."),
    UPLOAD_OBJECT_NOT_FOUND(HttpStatus.NOT_FOUND, "업로드된 객체를 찾을 수 없습니다."),
    TATTOO_NOT_FOUND(HttpStatus.NOT_FOUND, "타투를 찾을 수 없습니다."),
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "게시물을 찾을 수 없습니다."),
    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."),
    DM_ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "DM 채팅방을 찾을 수 없습니다."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "지원하지 않는 HTTP 메서드입니다."),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "지원하지 않는 미디어 타입입니다."),
    DUPLICATE_RESOURCE(HttpStatus.CONFLICT, "이미 존재하는 리소스입니다."),
    DUPLICATE_NICKNAME(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    DUPLICATE_PHONE_NUMBER(HttpStatus.CONFLICT, "이미 가입된 휴대폰 번호입니다."),
    DUPLICATE_REACTION(HttpStatus.CONFLICT, "이미 적용된 상태입니다."),
    STATE_CONFLICT(HttpStatus.CONFLICT, "현재 상태에서는 요청을 처리할 수 없습니다."),
    NOT_TATTOO_IMAGE(HttpStatus.UNPROCESSABLE_ENTITY, "타투 이미지가 아닙니다."),
    FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "파일 크기가 허용 범위를 초과했습니다."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."),
    UPSTREAM_SERVICE_ERROR(HttpStatus.BAD_GATEWAY, "외부 서비스 처리에 실패했습니다."),
    PROCESSING_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "외부 서비스 처리 시간이 초과되었습니다."),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "일시적으로 서비스를 사용할 수 없습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    public String code() {
        return name();
    }
}
