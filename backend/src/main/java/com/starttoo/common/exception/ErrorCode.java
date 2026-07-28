package com.starttoo.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "요청 값이 올바르지 않습니다."),
    INVALID_CURSOR(HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "커서 값이 올바르지 않습니다."),
    NICKNAME_FORMAT_INVALID(HttpStatus.BAD_REQUEST, "NICKNAME_FORMAT_INVALID", "닉네임 형식이 올바르지 않습니다."),
    NICKNAME_SUGGESTION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "NICKNAME_SUGGESTION_FAILED", "사용 가능한 닉네임을 생성하지 못했습니다."),
    NICKNAME_DUPLICATED(HttpStatus.CONFLICT, "NICKNAME_DUPLICATED", "이미 사용 중인 닉네임입니다."),
    SOCIAL_ACCOUNT_ALREADY_REGISTERED(HttpStatus.CONFLICT, "SOCIAL_ACCOUNT_ALREADY_REGISTERED", "이미 가입된 소셜 계정입니다."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "회원을 찾을 수 없습니다."),
    USE_MY_POSTS_ENDPOINT(HttpStatus.CONFLICT, "USE_MY_POSTS_ENDPOINT", "본인 게시글은 내 게시글 조회 API를 이용해 주세요."),
    USE_MY_COLLECTION_ENDPOINT(HttpStatus.CONFLICT, "USE_MY_COLLECTION_ENDPOINT", "본인 컬렉션은 내 컬렉션 조회 API를 이용해 주세요."),
    CANNOT_FOLLOW_SELF(HttpStatus.CONFLICT, "CANNOT_FOLLOW_SELF", "자기 자신을 팔로우할 수 없습니다."),
    CANNOT_BLOCK_SELF(HttpStatus.CONFLICT, "CANNOT_BLOCK_SELF", "자기 자신을 차단할 수 없습니다."),
    BLOCKED_RELATIONSHIP(HttpStatus.NOT_FOUND, "BLOCKED_RELATIONSHIP", "차단 관계인 회원입니다."),
    DEVICE_NOT_FOUND(HttpStatus.NOT_FOUND, "DEVICE_NOT_FOUND", "기기를 찾을 수 없습니다."),
    RECENT_SEARCH_NOT_FOUND(HttpStatus.NOT_FOUND, "RECENT_SEARCH_NOT_FOUND", "최근 검색어를 찾을 수 없습니다."),
    TATTOO_COLLECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "TATTOO_COLLECTION_NOT_FOUND", "타투 컬렉션 항목을 찾을 수 없습니다."),
    ARTIST_PROFILE_NOT_FOUND(HttpStatus.NOT_FOUND, "ARTIST_PROFILE_NOT_FOUND", "타투이스트 프로필을 찾을 수 없습니다."),
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다."),
    POST_EDIT_FORBIDDEN(HttpStatus.FORBIDDEN, "POST_EDIT_FORBIDDEN", "게시글을 수정할 권한이 없습니다."),
    POST_DELETE_FORBIDDEN(HttpStatus.FORBIDDEN, "POST_DELETE_FORBIDDEN", "게시글을 삭제할 권한이 없습니다."),
    CANNOT_REPORT_OWN_POST(HttpStatus.CONFLICT, "CANNOT_REPORT_OWN_POST", "자신의 게시글은 신고할 수 없습니다."),
    POST_ALREADY_REPORTED(HttpStatus.CONFLICT, "POST_ALREADY_REPORTED", "이미 신고한 게시글입니다."),
    REPORT_DECISION_INVALID(HttpStatus.BAD_REQUEST, "REPORT_DECISION_INVALID", "신고 처리 결정값이 올바르지 않습니다."),
    NO_PENDING_REPORTS(HttpStatus.CONFLICT, "NO_PENDING_REPORTS", "처리할 대기 신고가 없습니다."),
    IMAGE_IDS_DUPLICATED(HttpStatus.BAD_REQUEST, "IMAGE_IDS_DUPLICATED", "이미지 ID 목록에 중복 값이 있습니다."),
    IMAGE_IDS_INVALID(HttpStatus.BAD_REQUEST, "IMAGE_IDS_INVALID", "학습 완료 이미지 ID 목록이 올바르지 않습니다."),
    IMAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "IMAGE_NOT_FOUND", "학습 처리할 이미지를 찾을 수 없습니다."),
    APPROVAL_STATUS_INVALID(HttpStatus.BAD_REQUEST, "APPROVAL_STATUS_INVALID", "허용되지 않은 타투이스트 승인 상태입니다."),
    REJECTION_REASON_REQUIRED(HttpStatus.BAD_REQUEST, "REJECTION_REASON_REQUIRED", "거절 상태로 변경하려면 거절 사유가 필요합니다."),
    REJECTION_REASON_TOO_LONG(HttpStatus.BAD_REQUEST, "REJECTION_REASON_TOO_LONG", "거절 사유는 2000자 이하여야 합니다."),
    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다."),
    PARENT_COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "PARENT_COMMENT_NOT_FOUND", "부모 댓글을 찾을 수 없습니다."),
    REPLY_PARENT_REQUIRED(HttpStatus.BAD_REQUEST, "REPLY_PARENT_REQUIRED", "루트 댓글에 대해서만 답글을 조회할 수 있습니다."),
    REPLY_DEPTH_EXCEEDED(HttpStatus.BAD_REQUEST, "REPLY_DEPTH_EXCEEDED", "답글에는 다시 답글을 작성할 수 없습니다."),
    COMMENT_POST_MISMATCH(HttpStatus.CONFLICT, "COMMENT_POST_MISMATCH", "부모 댓글이 해당 게시글에 속하지 않습니다."),
    COMMENT_DELETE_FORBIDDEN(HttpStatus.FORBIDDEN, "COMMENT_DELETE_FORBIDDEN", "댓글을 삭제할 권한이 없습니다."),
    DM_ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "DM_ROOM_NOT_FOUND", "채팅방을 찾을 수 없습니다."),
    DM_PARTICIPANT_NOT_FOUND(HttpStatus.NOT_FOUND, "DM_PARTICIPANT_NOT_FOUND", "채팅 상대를 찾을 수 없습니다."),
    CANNOT_DM_SELF(HttpStatus.CONFLICT, "CANNOT_DM_SELF", "자기 자신과 채팅방을 만들 수 없습니다."),
    DM_BLOCKED(HttpStatus.CONFLICT, "DM_BLOCKED", "차단 관계에서는 DM을 사용할 수 없습니다."),
    NOT_DM_PARTICIPANT(HttpStatus.FORBIDDEN, "NOT_DM_PARTICIPANT", "채팅방 참여자가 아닙니다."),
    MESSAGE_ROOM_MISMATCH(HttpStatus.BAD_REQUEST, "MESSAGE_ROOM_MISMATCH", "해당 채팅방에 속하지 않은 메시지입니다."),
    MESSAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "메시지를 찾을 수 없습니다."),
    NOTIFICATION_NOT_FOUND(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "알림을 찾을 수 없습니다."),
    REFRESH_TOKEN_REQUIRED(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_REQUIRED", "Refresh Token이 필요합니다."),
    REFRESH_TOKEN_REUSED(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_REUSED", "이미 사용되거나 폐기된 Refresh Token입니다."),
    FEATURE_NOT_IMPLEMENTED(HttpStatus.NOT_IMPLEMENTED, "FEATURE_NOT_IMPLEMENTED", "아직 연결되지 않은 기능입니다."),
    SERVICE_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_NOT_CONFIGURED", "외부 서비스 설정이 필요합니다."),
    OAUTH_CODE_INVALID(HttpStatus.BAD_REQUEST, "OAUTH_CODE_INVALID", "소셜 로그인 인가 코드가 올바르지 않습니다."),
    OAUTH_PROVIDER_UNSUPPORTED(HttpStatus.BAD_REQUEST, "OAUTH_PROVIDER_UNSUPPORTED", "지원하지 않는 소셜 로그인 제공자입니다."),
    OAUTH_REDIRECT_URI_MISMATCH(HttpStatus.BAD_REQUEST, "OAUTH_REDIRECT_URI_MISMATCH", "리다이렉트 URI가 일치하지 않습니다."),
    OAUTH_PROVIDER_ERROR(HttpStatus.BAD_GATEWAY, "OAUTH_PROVIDER_ERROR", "소셜 로그인 제공자 연동에 실패했습니다."),
    OAUTH_PROVIDER_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "OAUTH_PROVIDER_TIMEOUT", "소셜 로그인 제공자 응답 시간이 초과되었습니다."),
    SIGNUP_TOKEN_INVALID(HttpStatus.BAD_REQUEST, "SIGNUP_TOKEN_INVALID", "회원가입 토큰이 올바르지 않습니다."),
    SIGNUP_TOKEN_EXPIRED(HttpStatus.BAD_REQUEST, "SIGNUP_TOKEN_EXPIRED", "회원가입 토큰이 만료되었습니다."),
    REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_INVALID", "Refresh Token이 올바르지 않습니다."),
    REFRESH_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_EXPIRED", "Refresh Token이 만료되었습니다."),
    ACCOUNT_SUSPENDED(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED", "정지된 계정입니다."),
    ACCOUNT_WITHDRAWN(HttpStatus.FORBIDDEN, "ACCOUNT_WITHDRAWN", "탈퇴한 계정입니다."),
    TATTOO_NOT_FOUND(HttpStatus.NOT_FOUND, "TATTOO_NOT_FOUND", "타투를 찾을 수 없습니다."),
    TATTOO_DESIGN_NOT_FOUND(HttpStatus.NOT_FOUND, "TATTOO_DESIGN_NOT_FOUND", "타투 도안을 찾을 수 없습니다."),
    TATTOO_DESIGN_REQUIRED(HttpStatus.CONFLICT, "TATTOO_DESIGN_REQUIRED", "AR 세션을 만들려면 타투 도안이 필요합니다."),
    SEARCH_INPUT_REQUIRED(HttpStatus.BAD_REQUEST, "SEARCH_INPUT_REQUIRED", "검색 텍스트 또는 이미지 중 하나 이상이 필요합니다."),
    AR_SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "AR_SESSION_NOT_FOUND", "AR 세션을 찾을 수 없습니다."),
    AR_SESSION_EXPIRED(HttpStatus.GONE, "AR_SESSION_EXPIRED", "AR 세션이 만료되었습니다."),
    CONNECT_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "CONNECT_TOKEN_INVALID", "유효하지 않은 AR 연결 토큰입니다."),
    SESSION_ALREADY_CONNECTED(HttpStatus.CONFLICT, "SESSION_ALREADY_CONNECTED", "이미 연결된 AR 세션입니다."),
    SESSION_OWNER_MISMATCH(HttpStatus.FORBIDDEN, "SESSION_OWNER_MISMATCH", "AR 세션을 조회할 권한이 없습니다."),
    AR_SESSION_NOT_CONNECTED(HttpStatus.CONFLICT, "AR_SESSION_NOT_CONNECTED", "모바일 웹이 연결되지 않은 AR 세션입니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "FORBIDDEN", "요청을 수행할 권한이 없습니다."),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "대상을 찾을 수 없습니다."),
    CONFLICT(HttpStatus.CONFLICT, "CONFLICT", "현재 상태에서는 요청을 처리할 수 없습니다."),
    DATA_INTEGRITY_VIOLATION(HttpStatus.CONFLICT, "DATA_INTEGRITY_VIOLATION", "데이터 제약조건을 위반했습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;

    ErrorCode(HttpStatus status, String code, String message) {
        this.status = status;
        this.code = code;
        this.message = message;
    }
}
