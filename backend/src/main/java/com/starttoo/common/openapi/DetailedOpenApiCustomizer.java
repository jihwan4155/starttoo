package com.starttoo.common.openapi;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.examples.Example;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * API 명세서의 요청·응답·처리·트랜잭션 규칙을 Swagger Operation에 합성한다.
 * Controller는 라우팅에 집중하고, 긴 운영 계약은 이 클래스에서 경로별로 관리한다.
 */
@Component
public class DetailedOpenApiCustomizer implements OpenApiCustomizer {

    private static final String READ_ONLY = "읽기 전용 DB 트랜잭션에서 조회하며 데이터를 변경하지 않습니다.";
    private static final String DB_TRANSACTION = "검증과 DB 변경을 하나의 트랜잭션으로 처리하며, 중간 단계가 실패하면 전체 DB 변경을 롤백합니다.";
    private static final String NO_DB_TRANSACTION = "DB를 변경하지 않습니다. 외부 시스템 호출은 MySQL 트랜잭션 대상이 아닙니다.";
    private static final Map<String, OperationDoc> DOCUMENTS = createDocuments();

    private static final Map<String, String> PARAMETER_DESCRIPTIONS = Map.ofEntries(
            Map.entry("cursor", "이전 응답의 nextCursor. 최초 요청은 생략하고 값을 해석하거나 수정하지 않습니다."),
            Map.entry("page", "관리자 목록의 페이지 번호입니다. 1부터 시작하며 page=3이면 세 번째 페이지를 바로 조회합니다."),
            Map.entry("size", "페이지당 개수. 일반 목록 기본 20, DM 메시지 기본 30이며 허용 범위는 1~50입니다."),
            Map.entry("sort", "정렬 방식. API별 허용값(LATEST, POPULAR 등)만 사용할 수 있습니다."),
            Map.entry("postType", "게시글 유형 필터. 생략하면 전체 유형을 조회합니다."),
            Map.entry("authorId", "작성자 회원 ID 필터. 생략하면 전체 작성자를 조회합니다."),
            Map.entry("shopCity", "숍 도시명. 앞뒤 공백만 제거하며 '서울'처럼 '시'를 제외한 값을 사용합니다."),
            Map.entry("nickname", "닉네임 입력값. 앞뒤 공백을 제거하며 중복 확인은 정확히 일치, 타투이스트 검색은 부분 일치를 사용합니다."),
            Map.entry("status", "상태 필터. 생략 시 API에서 정한 기본 범위를 조회합니다."),
            Map.entry("userId", "대상 회원 ID입니다."),
            Map.entry("tattooId", "대상 타투 ID입니다."),
            Map.entry("postId", "대상 게시글 ID입니다."),
            Map.entry("commentId", "대상 댓글 ID입니다."),
            Map.entry("collectionId", "대상 타투 컬렉션 ID입니다."),
            Map.entry("deviceId", "로그인 회원에게 등록된 기기 ID입니다."),
            Map.entry("recentSearchId", "로그인 회원의 최근 검색어 ID입니다."),
            Map.entry("dmRoomId", "대상 DM 채팅방 ID입니다."),
            Map.entry("notificationId", "로그인 회원이 수신한 알림 ID입니다."),
            Map.entry("sessionId", "AR 연결 세션의 UUID 문자열입니다."),
            Map.entry("connectToken", "QR URL에 포함된 일회성 AR 연결 토큰입니다.")
    );

    @Override
    public void customise(OpenAPI openApi) {
        if (openApi.getPaths() == null) {
            return;
        }
        openApi.getPaths().forEach((path, pathItem) ->
                pathItem.readOperationsMap().forEach((method, operation) -> {
                    OperationDoc document = DOCUMENTS.get(key(method, path));
                    if (document != null) {
                        operation.setDescription(document.markdown());
                    } else if (operation.getDescription() != null) {
                        operation.setDescription(plain(operation.getDescription()));
                    }
                    describeParameters(operation);
                    addCommonErrorResponses(operation);
                    addSuccessExamples(openApi, operation);
                })
        );
    }

    static int documentedOperationCount() {
        return DOCUMENTS.size();
    }

    static boolean contains(String method, String path) {
        return DOCUMENTS.containsKey(method.toUpperCase() + " " + path);
    }

    private void describeParameters(Operation operation) {
        if (operation.getParameters() == null) {
            return;
        }
        for (Parameter parameter : operation.getParameters()) {
            String description = PARAMETER_DESCRIPTIONS.get(parameter.getName());
            if (description != null) {
                parameter.setDescription(description);
            }
        }
    }

    private void addSuccessExamples(OpenAPI openApi, Operation operation) {
        if (operation.getResponses() == null) {
            return;
        }
        Map<String, Schema> schemas = openApi.getComponents() == null
                || openApi.getComponents().getSchemas() == null
                ? Map.of()
                : openApi.getComponents().getSchemas();

        operation.getResponses().forEach((status, response) -> {
            if (!status.matches("2\\d\\d") || response.getContent() == null) {
                return;
            }
            response.getContent().forEach((contentType, mediaType) -> {
                if (!contentType.toLowerCase().contains("json")
                        || mediaType.getSchema() == null
                        || mediaType.getExample() != null
                        || mediaType.getExamples() != null && !mediaType.getExamples().isEmpty()) {
                    return;
                }
                Object value = schemaExample(mediaType.getSchema(), schemas, Set.of(), 0, null);
                if (value != null) {
                    mediaType.addExamples("success", new Example()
                            .summary("성공 응답")
                            .value(value));
                }
            });
        });
    }

    private void addCommonErrorResponses(Operation operation) {
        if (operation.getResponses() == null) {
            operation.setResponses(new io.swagger.v3.oas.models.responses.ApiResponses());
        }
        operation.getResponses().putIfAbsent("400", errorResponse(
                400,
                "INVALID_REQUEST",
                "요청 값이 올바르지 않습니다.",
                "필수값, 형식, enum, page, size 또는 cursor 검증 실패"
        ));
        operation.getResponses().putIfAbsent("401", errorResponse(
                401,
                "UNAUTHORIZED",
                "인증이 필요합니다.",
                "Access Token 누락, 만료 또는 서명 오류"
        ));
        operation.getResponses().putIfAbsent("403", errorResponse(
                403,
                "FORBIDDEN",
                "요청을 수행할 권한이 없습니다.",
                "역할, 계정 상태 또는 리소스 소유권 부족"
        ));
        operation.getResponses().putIfAbsent("500", errorResponse(
                500,
                "INTERNAL_SERVER_ERROR",
                "서버 내부 오류가 발생했습니다.",
                "예상하지 못한 서버 오류"
        ));
    }

    private ApiResponse errorResponse(
            int status,
            String code,
            String message,
            String description
    ) {
        Schema<Object> schema = new Schema<>();
        schema.setType("object");
        schema.addProperty("status", new Schema<Integer>().type("integer").format("int32"));
        schema.addProperty("code", new Schema<String>().type("string"));
        schema.addProperty("message", new Schema<String>().type("string"));

        Map<String, Object> example = new LinkedHashMap<>();
        example.put("status", status);
        example.put("code", code);
        example.put("message", message);

        return new ApiResponse()
                .description(description)
                .content(new Content().addMediaType(
                        "application/json",
                        new MediaType().schema(schema).example(example)
                ));
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private Object schemaExample(
            Schema schema,
            Map<String, Schema> schemas,
            Set<String> resolving,
            int depth,
            String propertyName
    ) {
        if (schema == null || depth > 8) {
            return null;
        }
        if (schema.getExample() != null) {
            return schema.getExample();
        }
        if (schema.getDefault() != null) {
            return schema.getDefault();
        }
        if (schema.getEnum() != null && !schema.getEnum().isEmpty()) {
            return schema.getEnum().getFirst();
        }
        if (schema.get$ref() != null) {
            String name = schema.get$ref().substring(schema.get$ref().lastIndexOf('/') + 1);
            if (resolving.contains(name)) {
                return Map.of();
            }
            Set<String> next = new java.util.HashSet<>(resolving);
            next.add(name);
            return schemaExample(schemas.get(name), schemas, next, depth + 1, propertyName);
        }
        if (schema.getAllOf() != null && !schema.getAllOf().isEmpty()) {
            Map<String, Object> merged = new LinkedHashMap<>();
            for (Schema part : (List<Schema>) schema.getAllOf()) {
                Object value = schemaExample(part, schemas, resolving, depth + 1, propertyName);
                if (value instanceof Map<?, ?> map) {
                    map.forEach((key, item) -> merged.put(String.valueOf(key), item));
                }
            }
            return merged;
        }
        if (schema.getOneOf() != null && !schema.getOneOf().isEmpty()) {
            return schemaExample((Schema) schema.getOneOf().getFirst(), schemas, resolving, depth + 1, propertyName);
        }
        if (schema.getAnyOf() != null && !schema.getAnyOf().isEmpty()) {
            return schemaExample((Schema) schema.getAnyOf().getFirst(), schemas, resolving, depth + 1, propertyName);
        }
        if ("array".equals(schema.getType()) || schema.getItems() != null) {
            Object item = schemaExample(schema.getItems(), schemas, resolving, depth + 1, propertyName);
            return item == null ? List.of() : List.of(item);
        }
        if (schema.getProperties() != null && !schema.getProperties().isEmpty()) {
            Map<String, Object> result = new LinkedHashMap<>();
            ((Map<String, Schema>) schema.getProperties()).forEach((name, property) ->
                    result.put(name, schemaExample(property, schemas, resolving, depth + 1, name))
            );
            return result;
        }

        return switch (schema.getType() == null ? "object" : schema.getType()) {
            case "integer" -> numericExample(propertyName, false);
            case "number" -> numericExample(propertyName, true);
            case "boolean" -> true;
            case "string" -> stringExample(propertyName, schema.getFormat());
            default -> Map.of();
        };
    }

    private Object numericExample(String propertyName, boolean decimal) {
        if (propertyName != null) {
            String name = propertyName.toLowerCase();
            if (name.equals("size")) return 20;
            if (name.contains("count")) return 3;
            if (name.equals("page")) return 1;
            if (name.contains("totalpages")) return 5;
            if (name.contains("totalelements")) return 84;
        }
        return decimal ? 1.0 : 1L;
    }

    private String stringExample(String propertyName, String format) {
        if ("date-time".equals(format)) return "2026-07-22T10:30:00Z";
        if ("date".equals(format)) return "1998-04-12";
        if ("uuid".equals(format)) return "550e8400-e29b-41d4-a716-446655440000";
        if (propertyName == null) return "string";

        String name = propertyName.toLowerCase();
        if (name.contains("imageurl") || name.contains("uploadurl") || name.endsWith("url")) {
            return "https://storage.example.com/presigned-resource";
        }
        if (name.contains("objectkey") || name.endsWith("imagekey")) return "posts/101/uuid.webp";
        if (name.contains("email")) return "user@example.com";
        if (name.contains("nickname")) return "needlemoon";
        if (name.contains("accesstoken") || name.contains("refreshtoken") || name.contains("signuptoken")) {
            return "eyJhbGciOiJIUzI1NiJ9.example.signature";
        }
        if (name.equals("tokentype")) return "Bearer";
        if (name.equals("role")) return "USER";
        if (name.equals("provider")) return "KAKAO";
        if (name.equals("platform")) return "WEB";
        if (name.equals("method")) return "PUT";
        if (name.equals("poststatus")) return "PUBLISHED";
        if (name.equals("reportstatus")) return "PENDING";
        if (name.equals("approvalstatus")) return "PENDING";
        if (name.equals("accountstatus")) return "ACTIVE";
        if (name.equals("messagetype")) return "TEXT";
        if (name.contains("content")) return "예시 내용입니다.";
        return "string";
    }

    private static String plain(String value) {
        return value == null ? null : value.replace("`", "");
    }

    private static String key(PathItem.HttpMethod method, String path) {
        return method.name() + " " + path;
    }

    private static Map<String, OperationDoc> createDocuments() {
        Map<String, OperationDoc> docs = new LinkedHashMap<>();
        auth(docs);
        users(docs);
        artistsAndArchive(docs);
        generationAndUploads(docs);
        tattoosAndSimulation(docs);
        postsAndComments(docs);
        dmAndNotifications(docs);
        admin(docs);
        return Map.copyOf(docs);
    }

    private static void auth(Map<String, OperationDoc> docs) {
        add(docs, "POST", "/auth/social/login", doc(
                "카카오 또는 구글 인가 코드를 서버가 OAuth 제공자에 교환하여 소셜 회원을 식별합니다.",
                "`provider`, `authorizationCode`, 허용된 `redirectUri`, `platform`을 전달합니다. 앱에서 푸시를 사용하면 `pushToken`도 전달할 수 있습니다.",
                "기존 회원은 Access/Refresh Token과 회원 요약을 반환합니다. 미가입 계정은 `registrationRequired=true`, 짧게 만료되는 `signupToken`, 소셜 프로필을 반환합니다. 웹 Refresh Token은 HttpOnly 쿠키로 전달됩니다.",
                "정지·탈퇴 계정은 로그인할 수 없습니다. Redirect URI는 서버 허용 목록과 완전히 일치해야 합니다.",
                "OAuth 코드 교환은 외부 호출이라 롤백할 수 없습니다. 기존 회원의 기기 등록·재활성화와 Refresh Token 발급은 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 OAUTH_CODE_INVALID`, `400 OAUTH_REDIRECT_URI_MISMATCH`, `403 ACCOUNT_SUSPENDED/ACCOUNT_WITHDRAWN`, `502 OAUTH_PROVIDER_ERROR`, `504 OAUTH_PROVIDER_TIMEOUT`"
        ));
        add(docs, "POST", "/auth/signup", doc(
                "소셜 로그인에서 발급받은 signupToken으로 USER 또는 ARTIST 회원가입을 완료합니다.",
                "`signupToken`, 미중복 `nickname`, `role`, 선택적인 생년월일·성별·`profileImageKey`를 전달합니다. ARTIST는 숍 정보를 함께 전달할 수 있습니다.",
                "`201 Created`와 Access Token, Refresh Token 전달 정보, 생성된 회원 요약을 반환합니다. ARTIST 승인 상태는 `UNVERIFIED`로 시작합니다.",
                "profileImageKey가 없으면 서버 환경설정의 공용 기본 objectKey를 저장합니다. 값이 있으면 회원가입용 업로드 의도와 MinIO 객체를 검증하며, 프로필 이미지는 images 테이블에 등록하지 않습니다.",
                "이미지 검증은 DB 트랜잭션 밖의 외부 작업입니다. 검증 성공 후 회원, 선택적인 타투이스트 행, 기기, Refresh Token을 하나의 DB 트랜잭션으로 생성하며 하나라도 실패하면 DB 변경을 전부 롤백합니다.",
                "`400 SIGNUP_TOKEN_INVALID/SIGNUP_TOKEN_EXPIRED/NICKNAME_FORMAT_INVALID`, 공통 이미지 오류, `409 NICKNAME_DUPLICATED/SOCIAL_ACCOUNT_ALREADY_REGISTERED`, `501 FEATURE_NOT_IMPLEMENTED`(MinIO 미연결)"
        ));
        add(docs, "POST", "/auth/signup/profile-image/presigned-url", doc(
                "아직 Access Token이 없는 미가입 사용자가 프로필 이미지를 MinIO에 직접 업로드할 URL을 발급받습니다.",
                "소셜 로그인 응답의 `signupToken`, 실제 `contentType`, `fileSize`를 전달합니다.",
                "가입용 objectKey, Presigned PUT uploadUrl, method, contentType, expiresAt을 반환합니다.",
                "objectKey는 signupToken의 oauthProvider+oauthSubject에 귀속된 짧은 TTL 업로드 Intent로 관리합니다. 업로드 후 같은 signupToken의 회원가입 요청에 `profileImageKey`로 전달해야 합니다.",
                "DB를 변경하지 않습니다. 추후 Redis Intent와 MinIO Presigned URL 발급을 구현하며 현재는 501을 반환합니다.",
                "`400 SIGNUP_TOKEN_INVALID/SIGNUP_TOKEN_EXPIRED`, 공통 이미지 오류, `501 FEATURE_NOT_IMPLEMENTED`"
        ));
        add(docs, "POST", "/auth/token/refresh", doc(
                "유효한 Refresh Token을 회전하여 새 Access Token을 발급합니다.",
                "웹은 `refreshToken` HttpOnly 쿠키, 앱은 JSON 본문의 `refreshToken`을 사용합니다.",
                "새 Access Token과 만료 초를 반환합니다. 앱에는 새 Refresh Token도 반환하고 웹은 새 쿠키로 교체합니다.",
                "사용한 Refresh Token은 즉시 폐기됩니다. 폐기·재사용·만료 토큰은 인증 실패로 처리합니다.",
                "기존 Refresh Token 폐기와 새 Refresh Token 저장을 하나의 DB 트랜잭션으로 회전합니다.",
                "`401 REFRESH_TOKEN_REQUIRED/REFRESH_TOKEN_INVALID/REFRESH_TOKEN_EXPIRED/REFRESH_TOKEN_REUSED`, `403 ACCOUNT_SUSPENDED/ACCOUNT_WITHDRAWN`"
        ));
        add(docs, "POST", "/auth/logout", doc(
                "현재 사용자의 Refresh Token을 폐기하고 웹 Refresh Token 쿠키를 만료시킵니다.",
                "Access Token은 필수입니다. 웹은 쿠키, 앱은 선택적인 JSON 본문으로 Refresh Token을 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "토큰이 이미 없거나 폐기된 경우에도 최종 로그아웃 상태가 같도록 처리합니다.",
                "해당 Refresh Token 폐기는 하나의 DB 트랜잭션으로 처리합니다. 쿠키 만료는 HTTP 응답 작업이며 DB 롤백 대상이 아닙니다.",
                "`401 UNAUTHORIZED`"
        ));
        add(docs, "GET", "/auth/nicknames/availability", doc(
                "닉네임 형식과 현재 DB 중복 여부를 확인합니다.",
                "Query `nickname`을 전달합니다. 앞뒤 공백을 제거한 값이 2~50자여야 합니다.",
                "정규화된 닉네임과 `available` 여부를 반환합니다.",
                "조회 결과는 닉네임을 예약하지 않으므로 실제 회원가입·수정 시 다시 UNIQUE 제약과 중복 검사를 수행합니다.",
                READ_ONLY,
                "`400 NICKNAME_FORMAT_INVALID`"
        ));
        add(docs, "GET", "/auth/nicknames/suggestion", doc(
                "형용사와 명사 조합으로 현재 DB에 없는 무작위 닉네임을 추천합니다.",
                "요청 본문과 파라미터가 없습니다.",
                "추천한 닉네임 한 개를 반환합니다.",
                "추천값은 예약되지 않으므로 회원가입 시점에 다른 사용자가 먼저 사용할 수 있습니다.",
                READ_ONLY,
                "`500 NICKNAME_SUGGESTION_FAILED`"
        ));
    }

    private static void users(Map<String, OperationDoc> docs) {
        add(docs, "GET", "/users/me", doc(
                "로그인 회원의 공통 정보와 역할별 상세 정보를 조회합니다.",
                "Access Token만 필요하며 별도 입력은 없습니다.",
                "USER는 공통 회원·팔로우 수를, ARTIST는 동일한 공통 필드와 숍·인기도·승인 상태를 추가로 반환합니다. 이메일은 역할과 무관하게 포함됩니다.",
                "프로필 이미지가 있으면 저장된 objectKey로 조회용 Presigned URL을 생성합니다.",
                READ_ONLY,
                "`404 USER_NOT_FOUND`"
        ));
        add(docs, "PATCH", "/users/me", doc(
                "닉네임, 생년월일, 성별을 부분 수정합니다.",
                "변경할 필드만 전달합니다. nullable 필드는 `removeBirthDate`, `removeGender`로 명시적으로 제거합니다. 프로필 이미지는 전용 API를 사용합니다.",
                "변경된 회원 기본 정보와 `updatedAt`을 반환합니다.",
                "닉네임은 trim 후 2~50자이며 다른 회원과 중복될 수 없습니다. 역할·계정 상태는 변경할 수 없습니다.",
                DB_TRANSACTION,
                "`400 NICKNAME_FORMAT_INVALID/INVALID_REQUEST`, `404 USER_NOT_FOUND`, `409 NICKNAME_DUPLICATED`"
        ));
        add(docs, "PUT", "/users/me/profile-image", doc(
                "업로드 완료된 이미지를 로그인 회원의 프로필 이미지로 등록하거나 교체합니다.",
                "`profileImageObjectKey`를 필수로 전달합니다. 먼저 Presigned PUT으로 업로드를 완료해야 합니다.",
                "새 조회용 `profileImageUrl`과 `updatedAt`을 반환합니다.",
                "MinIO 객체의 존재·소유권·실제 형식을 확인하고 `users.profile_image_key`에 직접 저장합니다. `images` 행은 만들지 않습니다.",
                "MinIO 검증은 외부 작업이며 DB 트랜잭션에 포함되지 않습니다. 검증 성공 후 profile_image_key 변경만 DB 트랜잭션으로 커밋합니다. 기존 객체 실제 삭제는 별도 정리·재시도 정책 대상입니다.",
                "공통 이미지 오류, `404 USER_NOT_FOUND`, `501 FEATURE_NOT_IMPLEMENTED`(MinIO 미연결)"
        ));
        add(docs, "DELETE", "/users/me/profile-image", doc(
                "로그인 회원의 프로필 이미지를 공용 기본 이미지로 되돌립니다.",
                "별도 입력이 없습니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "`users.profile_image_key`를 환경설정의 기본 objectKey로 변경합니다. 기본 이미지는 여러 회원이 공유하고 images 테이블에 등록하지 않으며 스토리지 삭제 대상에서도 제외합니다.",
                DB_TRANSACTION,
                "`404 USER_NOT_FOUND`"
        ));
        add(docs, "DELETE", "/users/me", doc(
                "회원 데이터를 즉시 물리 삭제하지 않고 계정을 탈퇴 상태로 변경합니다.",
                "선택적으로 최대 255자의 `reason`을 전달할 수 있습니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "`account_status=WITHDRAWN`, `withdrawn_at`을 기록하고 활성 Refresh Token과 Push 기기를 비활성화합니다.",
                "회원 상태 변경, 전체 Refresh Token 폐기, 활성 기기 비활성화를 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 USER_NOT_FOUND`"
        ));
        add(docs, "GET", "/users/{userId}", doc(
                "다른 회원의 공개 프로필을 조회합니다. 인증은 선택입니다.",
                "Path `userId`만 전달합니다.",
                "닉네임·프로필 이미지·역할·팔로우 수와 타투이스트 공개 정보를 반환합니다. 로그인 시 `isFollowing`, `isMe`가 개인화됩니다.",
                "어느 방향이든 차단 관계이면 회원 존재 노출을 줄이기 위해 404로 처리합니다.",
                READ_ONLY,
                "`404 USER_NOT_FOUND/BLOCKED_RELATIONSHIP`"
        ));
        add(docs, "POST", "/users/{userId}/follow", doc(
                "대상 회원을 팔로우합니다.",
                "Path `userId`를 전달하며 본인은 대상이 될 수 없습니다.",
                "최종 `following=true`와 대상 회원의 최신 followerCount를 반환합니다.",
                "이미 팔로우 중이어도 성공하는 멱등 토글입니다. 차단 관계에서는 처리하지 않습니다.",
                DB_TRANSACTION,
                "`404 USER_NOT_FOUND`, `409 CANNOT_FOLLOW_SELF`, 차단 관계 오류"
        ));
        add(docs, "DELETE", "/users/{userId}/follow", doc(
                "대상 회원 팔로우를 해제합니다.",
                "Path `userId`를 전달합니다.",
                "최종 `following=false`와 대상 회원의 최신 followerCount를 반환합니다.",
                "관계 행을 실제 삭제하며 이미 해제된 상태에서도 성공합니다.",
                DB_TRANSACTION,
                "`404 USER_NOT_FOUND`, `409 CANNOT_FOLLOW_SELF`"
        ));
        add(docs, "POST", "/users/me/devices", doc(
                "푸시 토큰을 새 기기로 등록하거나 기존 토큰을 현재 회원 기기로 재활성화합니다.",
                "`pushToken`과 `platform`(`WEB`, `ANDROID`, `IOS`)을 전달합니다.",
                "새 행이면 `201 Created`, 기존 토큰 재활성화이면 `200 OK`와 기기 정보를 반환합니다.",
                "pushToken은 시스템 전체에서 유일하며 동일 토큰 재등록 시 소유 회원·플랫폼·마지막 사용 시각을 갱신합니다.",
                DB_TRANSACTION,
                "`400 INVALID_REQUEST`"
        ));
        add(docs, "DELETE", "/users/me/devices/{deviceId}", doc(
                "로그인 회원의 푸시 기기를 비활성화합니다.",
                "Path `deviceId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "행을 삭제하지 않고 `active=false`로 변경합니다.",
                DB_TRANSACTION,
                "`404 DEVICE_NOT_FOUND`"
        ));
        add(docs, "GET", "/users/{userId}/followers", doc(
                "대상 회원을 팔로우하는 회원 목록을 커서 방식으로 조회합니다. 인증은 선택입니다.",
                "Path `userId`, 선택적인 `cursor`, `size`를 사용합니다.",
                "회원 요약, 관계 생성 시각과 로그인 사용자의 `isFollowing`을 포함한 페이지를 반환합니다.",
                "차단 관계인 회원은 목록에서 제외합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`, `404 USER_NOT_FOUND`"
        ));
        add(docs, "GET", "/users/{userId}/following", doc(
                "대상 회원이 팔로우하는 회원 목록을 커서 방식으로 조회합니다. 인증은 선택입니다.",
                "Path `userId`, 선택적인 `cursor`, `size`를 사용합니다.",
                "회원 요약, 관계 생성 시각과 로그인 사용자의 `isFollowing`을 포함한 페이지를 반환합니다.",
                "차단 관계인 회원은 목록에서 제외합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`, `404 USER_NOT_FOUND`"
        ));
        add(docs, "GET", "/users/me/recent-searches", doc(
                "로그인 회원의 최근 검색어를 최신순으로 최대 10개 조회합니다.",
                "별도 입력이 없습니다.",
                "최근 검색어 ID, keyword, searchedAt 목록을 반환합니다.",
                "이 기능은 별도 페이지네이션을 사용하지 않습니다.",
                READ_ONLY,
                "인증 공통 오류"
        ));
        add(docs, "POST", "/users/me/recent-searches", doc(
                "검색어를 최근 검색 목록에 저장합니다.",
                "trim 후 비어 있지 않은 `keyword`를 전달합니다.",
                "저장 또는 갱신된 최근 검색어를 반환합니다.",
                "같은 키워드는 새 행을 중복 생성하지 않고 searchedAt을 갱신합니다. 저장 후 최신 10개를 초과한 오래된 행은 삭제합니다.",
                "검색어 upsert와 10개 초과 행 삭제를 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 INVALID_REQUEST`"
        ));
        add(docs, "DELETE", "/users/me/recent-searches/{recentSearchId}", doc(
                "최근 검색어 한 건을 삭제합니다.",
                "Path `recentSearchId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "반드시 로그인 회원 소유의 검색어만 삭제할 수 있습니다.",
                DB_TRANSACTION,
                "`404 RECENT_SEARCH_NOT_FOUND`"
        ));
        add(docs, "DELETE", "/users/me/recent-searches", doc(
                "로그인 회원의 최근 검색어를 전부 삭제합니다.",
                "별도 입력이 없습니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "삭제할 행이 없어도 성공합니다.",
                DB_TRANSACTION,
                "인증 공통 오류"
        ));
        add(docs, "GET", "/users/me/blocks", doc(
                "로그인 회원이 차단한 회원 목록을 커서 방식으로 조회합니다.",
                "선택적인 `cursor`, `size`를 사용합니다.",
                "차단 회원의 공개 요약과 blockedAt을 반환합니다.",
                "차단한 방향만 조회하며, 상대가 나를 차단한 목록은 포함하지 않습니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`"
        ));
        add(docs, "POST", "/users/{userId}/block", doc(
                "대상 회원을 차단하고 양방향 팔로우 관계를 함께 제거합니다.",
                "Path `userId`를 전달하며 본인은 차단할 수 없습니다.",
                "최종 `blocked=true`를 반환합니다.",
                "이미 차단된 경우에도 성공합니다. 이후 프로필·피드·댓글·컬렉션·타투이스트 카드·DM 노출에서 양방향 차단 필터를 적용합니다.",
                "차단 행 저장과 두 방향 팔로우 행 삭제를 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 USER_NOT_FOUND`, `409 CANNOT_BLOCK_SELF`"
        ));
        add(docs, "DELETE", "/users/{userId}/block", doc(
                "대상 회원 차단을 해제합니다.",
                "Path `userId`를 전달합니다.",
                "최종 `blocked=false`를 반환합니다.",
                "차단 관계 행만 실제 삭제하며 이전 팔로우 관계는 자동 복구하지 않습니다. 이미 해제된 상태에서도 성공합니다.",
                DB_TRANSACTION,
                "`409 CANNOT_BLOCK_SELF`"
        ));
        add(docs, "PUT", "/users/me/tattoo-preferences", doc(
                "온보딩 타투 취향 조사 결과를 전체 교체 방식으로 저장합니다.",
                "중복되지 않은 `tattooIds` 배열과 선택적인 `score`를 전달합니다. score 기본값은 1.0000입니다.",
                "저장 출처 `SURVEY`, tattooIds, 저장 개수, updatedAt을 반환합니다.",
                "배열의 모든 tattooId가 존재해야 합니다. 기존 SURVEY 선호를 모두 지운 후 요청 배열로 대체합니다.",
                "기존 SURVEY 행 삭제와 새 선호 행 일괄 저장을 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 INVALID_REQUEST`, `404 TATTOO_NOT_FOUND`"
        ));
        add(docs, "GET", "/users/me/tattoo-collections", doc(
                "로그인 회원의 타투 컬렉션을 최신순으로 조회합니다.",
                "선택적인 `cursor`, `size`를 사용합니다.",
                "신체 부위, imageId, 조회용 imageUrl, 생성·수정 시각을 포함한 페이지를 반환합니다.",
                "모든 컬렉션은 공개 데이터이지만 이 경로는 본인 전용입니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`"
        ));
        add(docs, "GET", "/users/{userId}/tattoo-collections", doc(
                "다른 회원의 공개 타투 컬렉션을 최신순으로 조회합니다.",
                "인증이 필수이며 Path `userId`, 선택적인 `cursor`, `size`를 사용합니다.",
                "대상 회원의 컬렉션 페이지를 반환합니다.",
                "본인 userId를 요청하면 내 컬렉션 전용 API 사용을 요구하며, 차단 관계이면 404로 처리합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`, `404 USER_NOT_FOUND`, `409 USE_MY_COLLECTION_ENDPOINT`"
        ));
        add(docs, "POST", "/users/me/tattoo-collections", doc(
                "로그인 회원의 타투 컬렉션에 이미지를 등록합니다.",
                "`bodyPart`와 업로드 완료된 `imageObjectKey`를 전달합니다.",
                "`201 Created`와 생성된 컬렉션 항목을 반환합니다.",
                "MinIO 객체를 검증하고 `images` 행을 확보한 뒤 컬렉션이 이를 참조합니다.",
                "MinIO 검증은 외부 작업입니다. images 행 등록과 tattoo_collections 행 생성은 하나의 DB 트랜잭션으로 처리합니다.",
                "공통 이미지 오류, `501 FEATURE_NOT_IMPLEMENTED`(MinIO 미연결)"
        ));
        add(docs, "PATCH", "/users/me/tattoo-collections/{collectionId}", doc(
                "본인 컬렉션의 신체 부위 또는 이미지를 부분 수정합니다.",
                "Path `collectionId`와 변경할 `bodyPart`, `imageObjectKey`를 전달합니다.",
                "수정된 컬렉션 항목을 반환합니다.",
                "새 이미지가 있으면 MinIO 검증과 images 행 확보 후 참조를 교체합니다. 전달하지 않은 필드는 유지합니다.",
                "MinIO 검증은 외부 작업입니다. images 등록과 컬렉션 참조 변경은 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 TATTOO_COLLECTION_NOT_FOUND`, 공통 이미지 오류"
        ));
        add(docs, "DELETE", "/users/me/tattoo-collections/{collectionId}", doc(
                "본인 타투 컬렉션 항목을 삭제합니다.",
                "Path `collectionId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "컬렉션 관계 행을 삭제합니다. 연결된 images 행과 MinIO 객체의 정리는 별도 미참조 이미지 정책을 따릅니다.",
                DB_TRANSACTION,
                "`404 TATTOO_COLLECTION_NOT_FOUND`"
        ));
    }

    private static void artistsAndArchive(Map<String, OperationDoc> docs) {
        add(docs, "GET", "/artists", doc(
                "타투이스트 카드 목록을 검색 조건에 맞게 조회합니다. 인증은 선택입니다.",
                "`shopCity`, `nickname`을 각각 또는 함께 사용할 수 있고, `cursor`, `size`로 페이지를 이동합니다.",
                "회원·프로필 이미지·숍 정보·승인 상태·인기도·팔로워 수·개인화 값과 최신 피드 이미지 최대 6개(postId, imageUrl, likeCount)를 반환합니다.",
                "nickname은 부분 일치/일치도순, nickname이 없으면 popularity 내림차순입니다. shopCity는 trim 후 정확히 일치합니다. 인증 시 차단·관심없음·팔로우 개인화를 적용합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`"
        ));
        add(docs, "PATCH", "/artists/me", doc(
                "로그인 타투이스트의 숍 프로필을 부분 수정합니다.",
                "숍 이름·도시·주소·전화번호·영업시간 중 변경할 값을 전달합니다.",
                "수정된 숍 정보와 서버 관리 필드인 popularity, approvalStatus, rejectionReason, approvedAt을 반환합니다.",
                "popularity와 승인 상태는 이 API로 변경할 수 없습니다. ARTIST 역할이더라도 tattoo_artists 행이 없으면 오류입니다.",
                DB_TRANSACTION,
                "`403 FORBIDDEN`, `404 ARTIST_PROFILE_NOT_FOUND`"
        ));
        add(docs, "GET", "/archive", doc(
                "로그인 회원이 보관한 타투 도안 목록을 저장 시각 역순으로 조회합니다.",
                "선택적인 `cursor`, `size`를 사용합니다.",
                "tattooId, 원본·도안 imageUrl, 스타일, 선택적인 rendering, savedAt을 포함한 페이지를 반환합니다.",
                "보관 대상은 tattoo_designs가 존재하는 타투만 가능합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`, `404 TATTOO_NOT_FOUND`"
        ));
        add(docs, "POST", "/archive/{tattooId}", doc(
                "타투 도안을 내 보관함에 저장합니다.",
                "Path `tattooId`를 전달합니다.",
                "최종 `saved=true`와 savedAt을 반환합니다.",
                "같은 요청을 반복해도 중복 행을 만들지 않습니다. 원본 타투뿐 아니라 가공된 tattoo_designs가 존재해야 합니다.",
                DB_TRANSACTION,
                "`404 TATTOO_NOT_FOUND`, `409 TATTOO_DESIGN_REQUIRED`"
        ));
        add(docs, "DELETE", "/archive/{tattooId}", doc(
                "타투 도안을 내 보관함에서 제거합니다.",
                "Path `tattooId`를 전달합니다.",
                "최종 `saved=false`를 반환합니다.",
                "관계 행을 실제 삭제하며 이미 제거된 상태에서도 성공합니다.",
                DB_TRANSACTION,
                "`404 TATTOO_NOT_FOUND`"
        ));
    }

    private static void generationAndUploads(Map<String, OperationDoc> docs) {
        add(docs, "POST", "/uploads/presigned-url", doc(
                "클라이언트가 MinIO에 이미지를 직접 업로드할 수 있도록 짧게 만료되는 Presigned PUT URL을 발급합니다.",
                "`purpose`, 허용된 `contentType`(`image/jpeg`, `image/png`, `image/webp`), 1~10MB의 `fileSize`를 전달합니다.",
                "서버가 생성한 `objectKey`, PUT `uploadUrl`, method, contentType, expiresAt을 반환합니다.",
                "이 API는 업로드 권한만 발급합니다. 클라이언트가 PUT을 완료한 뒤 도메인 API에 objectKey를 전달해야 DB 등록이 완료됩니다.",
                NO_DB_TRANSACTION,
                "공통 이미지 크기·형식 오류, `501 FEATURE_NOT_IMPLEMENTED`(MinIO 미연결)"
        ));
        add(docs, "POST", "/ai/generations", doc(
                "스타일과 프롬프트를 모델에 전달하여 타투 도안을 동기로 생성합니다.",
                "`primaryStyle`, 선택적인 `secondaryStyle`, `promptText`, 선택적인 `referenceImageObjectKey`를 전달합니다.",
                "모델 처리가 끝난 뒤 생성 이미지의 objectKey 또는 조회용 imageUrl과 분류 정보를 한 응답으로 반환합니다.",
                "생성 이력을 DB에 저장하지 않습니다. 요청 연결이 유지되는 동안 동기로 처리하므로 별도 generationId나 상태 조회 API가 없습니다.",
                "FastAPI·모델 호출과 이미지 저장은 외부 작업이며 MySQL 트랜잭션 대상이 아닙니다. 현재는 계약용 DTO만 있고 501을 반환합니다.",
                "공통 이미지 오류, 모델 처리 오류, `501 FEATURE_NOT_IMPLEMENTED`"
        ));
        add(docs, "POST", "/coverups/recommendations", doc(
                "기존 타투 이미지에 적합한 커버업 결과를 동기로 추천합니다.",
                "Presigned PUT 업로드를 마친 `imageObjectKey`를 전달합니다.",
                "추천 결과 이미지와 분석·분류 정보를 모델 처리가 끝난 뒤 한 번에 반환합니다.",
                "생성 이력과 비동기 상태를 DB에 저장하지 않습니다. 이미지 객체 검증 후 FastAPI 모델을 호출할 예정입니다.",
                "MinIO와 FastAPI 호출은 외부 작업이며 MySQL 트랜잭션 대상이 아닙니다. 현재는 501을 반환합니다.",
                "공통 이미지 오류, 신체·타투 영역 미탐지 오류, `501 FEATURE_NOT_IMPLEMENTED`"
        ));
    }

    private static void tattoosAndSimulation(Map<String, OperationDoc> docs) {
        add(docs, "GET", "/tattoos/{tattooId}", doc(
                "타투 원본의 소유자·출처·스타일·색상·렌더링·이미지와 도안 존재 여부를 조회합니다. 인증은 선택입니다.",
                "Path `tattooId`를 전달합니다.",
                "원본 imageId/imageUrl, 분류 정보와 선택적인 `rendering`, owner, `hasDesign`, createdAt을 반환합니다.",
                "로그인 사용자가 타투 소유자와 차단 관계이면 존재 여부 노출을 줄이기 위해 404로 처리합니다.",
                READ_ONLY,
                "`404 TATTOO_NOT_FOUND`"
        ));
        add(docs, "GET", "/tattoos/{tattooId}/image", doc(
                "tattooId에 연결된 원본 이미지의 조회용 URL을 반환합니다. 인증은 선택입니다.",
                "Path `tattooId`를 전달합니다.",
                "tattooId, imageId, 만료되는 Presigned GET imageUrl을 반환합니다.",
                "응답 URL은 영구 저장하지 않고 만료 시 다시 조회해야 합니다. 차단 관계를 동일하게 적용합니다.",
                READ_ONLY,
                "`404 TATTOO_NOT_FOUND`, `501 FEATURE_NOT_IMPLEMENTED`(MinIO 미연결)"
        ));
        add(docs, "GET", "/tattoos/{tattooId}/design", doc(
                "tattooId와 1:0 또는 1:1로 연결된 가공 타투 도안을 조회합니다. 인증은 선택입니다.",
                "Path `tattooId`를 전달합니다.",
                "tattooId, 도안 imageId/imageUrl, createdAt, updatedAt을 반환합니다.",
                "원본 타투는 존재하지만 tattoo_designs가 없으면 별도의 NOT_FOUND 오류입니다.",
                READ_ONLY,
                "`404 TATTOO_NOT_FOUND/TATTOO_DESIGN_NOT_FOUND`"
        ));
        add(docs, "POST", "/tattoos/{tattooId}/design", doc(
                "원본 타투 이미지를 모델로 가공해 tattoo_designs를 동기로 생성하거나 덮어씁니다.",
                "Path `tattooId`를 전달하며 Access Token이 필요합니다.",
                "처리 완료 후 새 도안 imageId/imageUrl과 시각 정보를 반환합니다. 기존 도안 존재 여부와 관계없이 정상 처리합니다.",
                "기존 도안이 있으면 오류를 반환하지 않고 새 이미지 참조로 교체합니다. 현재 모델 연결 전이라 501을 반환합니다.",
                "모델·MinIO 작업은 외부 작업입니다. 구현 시 새 images 등록과 tattoo_designs upsert만 하나의 DB 트랜잭션으로 묶고 외부 실패는 보상 정책을 적용해야 합니다.",
                "`404 TATTOO_NOT_FOUND`, 모델·이미지 오류, `501 FEATURE_NOT_IMPLEMENTED`"
        ));
        add(docs, "POST", "/simulations/ar-sessions", doc(
                "웹에서 선택한 타투 도안을 모바일 웹 카메라와 연결하기 위한 임시 AR 세션을 생성합니다.",
                "`tattooId`를 전달합니다. AR에 사용할 tattoo_designs가 존재해야 합니다.",
                "`201 Created`와 sessionId, connectToken이 포함된 모바일 captureUrl, QR URL, 상태, expiresAt을 반환합니다.",
                "세션은 서버 메모리에 저장되고 짧게 만료됩니다. QR은 앱 설치 없이 모바일 브라우저 카메라 페이지를 엽니다.",
                "MySQL을 사용하지 않는 메모리 상태 변경입니다. 단일 서버 프로세스 범위이며 다중 서버 운영 시 Redis 같은 공유 저장소가 필요합니다.",
                "`404 TATTOO_NOT_FOUND`, `409 TATTOO_DESIGN_REQUIRED`"
        ));
        add(docs, "POST", "/simulations/ar-sessions/{sessionId}/connect", doc(
                "QR로 열린 모바일 웹을 AR 세션에 연결합니다.",
                "Path `sessionId`와 본문의 `connectToken`을 전달합니다.",
                "연결된 세션 상태와 WebSocket 시그널링 정보를 반환합니다.",
                "유효한 토큰으로 만료 전 한 번 연결하며, 이후 모바일 카메라 스트림은 WebRTC로 웹에 전달합니다.",
                "메모리 세션 상태를 원자적으로 CONNECTED로 변경합니다. DB 트랜잭션은 사용하지 않습니다.",
                "`401 CONNECT_TOKEN_INVALID`, `404 AR_SESSION_NOT_FOUND`, `409 SESSION_ALREADY_CONNECTED`, `410 AR_SESSION_EXPIRED`"
        ));
        add(docs, "GET", "/simulations/ar-sessions/{sessionId}", doc(
                "로그인 세션 소유자가 AR 연결 상태를 조회합니다.",
                "Path `sessionId`를 전달합니다.",
                "세션 상태, 연결 시각, 만료 시각과 필요한 연결 정보를 반환합니다.",
                "세션 생성자만 조회할 수 있으며 만료된 세션은 410으로 처리합니다.",
                "메모리 상태만 읽으며 DB를 변경하지 않습니다.",
                "`403 SESSION_OWNER_MISMATCH`, `404 AR_SESSION_NOT_FOUND`, `410 AR_SESSION_EXPIRED`"
        ));
        add(docs, "GET", "/simulations/ar-sessions/{sessionId}/qr", doc(
                "모바일 촬영 페이지 URL을 담은 320x320 PNG QR 이미지를 반환합니다.",
                "Path `sessionId`와 Query `connectToken`을 전달합니다.",
                "`image/png` 바이너리를 반환합니다.",
                "QR 생성 전에 세션과 연결 토큰, 만료 여부를 검증합니다. JSON 응답이 아닌 이미지 응답입니다.",
                NO_DB_TRANSACTION,
                "`401 CONNECT_TOKEN_INVALID`, `404 AR_SESSION_NOT_FOUND`, `410 AR_SESSION_EXPIRED`"
        ));
        add(docs, "POST", "/simulations/ar-sessions/{sessionId}/composites", doc(
                "AR 세션의 타투 도안과 업로드한 신체 이미지를 모델로 합성합니다.",
                "Path `sessionId`와 업로드 완료된 `bodyImageObjectKey`를 전달합니다.",
                "합성 결과 이미지와 관련 정보를 동기 응답으로 반환할 예정입니다.",
                "세션 소유권·연결·만료 상태를 먼저 확인합니다. 현재 합성 모델 연결 전이라 501을 반환합니다.",
                "MinIO·합성 모델 호출은 외부 작업이며 MySQL 트랜잭션 대상이 아닙니다.",
                "`403 SESSION_OWNER_MISMATCH`, `404 AR_SESSION_NOT_FOUND`, `409 AR_SESSION_NOT_CONNECTED`, `410 AR_SESSION_EXPIRED`, 공통 이미지 오류, `501 FEATURE_NOT_IMPLEMENTED`"
        ));
    }

    private static void postsAndComments(Map<String, OperationDoc> docs) {
        add(docs, "GET", "/posts", doc(
                "인증 없이 접근할 수 있는 공개 전체 피드를 조회합니다.",
                "선택적인 `cursor`, `size`, `sort`, `postType`, `authorId` 필터를 사용합니다.",
                "게시글·작성자·이미지·카운트를 포함한 페이지를 반환합니다. 비로그인 전용이므로 개인 좋아요·북마크 상태는 포함하지 않습니다.",
                "`post_status=PUBLISHED`만 노출합니다. LATEST는 최신순, POPULAR는 좋아요 수와 postId 기준으로 정렬합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR/INVALID_REQUEST`"
        ));
        add(docs, "GET", "/posts/{postId}", doc(
                "공개 게시글 한 건을 조회합니다. 인증은 선택입니다.",
                "Path `postId`를 전달합니다.",
                "본문, 작성자, 정렬된 이미지, 좋아요·댓글·신고 수와 로그인 시 개인 좋아요·북마크 상태를 반환합니다.",
                "PUBLISHED만 일반 조회할 수 있습니다. HIDDEN·DELETED 또는 차단 관계 게시글은 404로 처리합니다.",
                READ_ONLY,
                "`404 POST_NOT_FOUND`"
        ));
        add(docs, "POST", "/posts", doc(
                "업로드 완료 이미지로 커뮤니티 게시글을 작성합니다.",
                "`postType`, 선택적인 `content`, 1~10개의 `images[].objectKey`를 전달합니다. 이미지만 필수이며 텍스트는 선택입니다.",
                "`201 Created`와 생성된 게시글 상세를 반환합니다.",
                "각 objectKey를 검증하고 images, post_images, USER_POST 출처 tattoos를 생성합니다. ARTIST 전용 게시글 유형은 역할을 검증합니다.",
                "MinIO 검증은 외부 작업입니다. posts 행, images 확보, post_images 순서, tattoos 행 생성을 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 INVALID_REQUEST`, `403 FORBIDDEN`, 이미지 오류, `409 CONFLICT`(이미 사용된 이미지)"
        ));
        add(docs, "PATCH", "/posts/{postId}", doc(
                "본인 게시글의 유형·내용·이미지 구성을 수정합니다.",
                "Path `postId`, 유지할 `retainedPostImageIds`, 새 `newImages[].objectKey`, 변경할 postType/content를 전달합니다.",
                "수정 후 게시글 상세와 최종 이미지 순서를 반환합니다.",
                "유지 목록 순서대로 기존 이미지를 재정렬하고 제외된 연결을 제거한 뒤 새 이미지를 뒤에 추가합니다. 최종 이미지는 1~10장이어야 합니다.",
                "MinIO 검증은 외부 작업입니다. 게시글 수정, 기존 연결 삭제·재정렬, 새 images/post_images/tattoos 생성을 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 INVALID_REQUEST`, `403 POST_EDIT_FORBIDDEN`, `404 POST_NOT_FOUND`, 이미지 오류, `409 CONFLICT`"
        ));
        add(docs, "DELETE", "/posts/{postId}", doc(
                "본인 게시글을 소프트 삭제합니다.",
                "Path `postId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "행을 물리 삭제하지 않고 post_status를 DELETED로 변경하여 일반 회원 조회에서 제외합니다.",
                DB_TRANSACTION,
                "`403 POST_DELETE_FORBIDDEN`, `404 POST_NOT_FOUND`"
        ));
        add(docs, "POST", "/posts/{postId}/like", doc(
                "게시글에 좋아요를 설정합니다.",
                "Path `postId`를 전달합니다.",
                "최종 `liked=true`와 최신 likeCount를 반환합니다.",
                "동일 요청을 반복해도 중복 좋아요 행을 만들거나 카운트를 다시 증가시키지 않습니다.",
                "post_likes 관계 행 생성과 posts.like_count 증가를 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 POST_NOT_FOUND`"
        ));
        add(docs, "DELETE", "/posts/{postId}/like", doc(
                "게시글 좋아요를 취소합니다.",
                "Path `postId`를 전달합니다.",
                "최종 `liked=false`와 최신 likeCount를 반환합니다.",
                "좋아요 관계 행을 실제 삭제합니다. 이미 취소된 상태에서도 카운트를 다시 감소시키지 않고 성공합니다.",
                "post_likes 관계 행 삭제와 posts.like_count 감소를 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 POST_NOT_FOUND`"
        ));
        add(docs, "POST", "/posts/{postId}/bookmark", doc(
                "게시글을 내 북마크에 저장합니다.",
                "Path `postId`를 전달합니다.",
                "최종 `bookmarked=true`를 반환합니다.",
                "동일 요청을 반복해도 중복 관계 행을 만들지 않습니다.",
                DB_TRANSACTION,
                "`404 POST_NOT_FOUND`"
        ));
        add(docs, "DELETE", "/posts/{postId}/bookmark", doc(
                "게시글 북마크를 취소합니다.",
                "Path `postId`를 전달합니다.",
                "최종 `bookmarked=false`를 반환합니다.",
                "post_bookmarks 관계 행을 실제 삭제하며 이미 취소된 상태에서도 성공합니다.",
                DB_TRANSACTION,
                "`404 POST_NOT_FOUND`"
        ));
        add(docs, "POST", "/posts/{postId}/reports", doc(
                "게시글을 사유와 함께 신고합니다.",
                "Path `postId`, `reasonCode`, 선택적인 `reasonDetail`을 전달합니다. reasonCode가 OTHER이면 상세 사유가 필수입니다.",
                "`201 Created`와 reportId, 상태 PENDING, 신고 내용을 반환합니다.",
                "본인 게시글은 신고할 수 없고 한 사용자는 같은 게시글을 한 번만 신고할 수 있습니다.",
                "post_reports 행 생성과 posts.report_count 증가를 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 INVALID_REQUEST`, `404 POST_NOT_FOUND`, `409 CANNOT_REPORT_OWN_POST/POST_ALREADY_REPORTED`"
        ));
        add(docs, "POST", "/posts/{postId}/hidden", doc(
                "게시글을 로그인 회원의 관심 없음 목록에 추가합니다.",
                "Path `postId`를 전달합니다.",
                "최종 `hidden=true`를 반환합니다.",
                "이후 개인화 피드·타투이스트 피드 미리보기 등에서 해당 게시글을 제외합니다. 반복 요청은 멱등합니다.",
                DB_TRANSACTION,
                "`404 POST_NOT_FOUND`"
        ));
        add(docs, "DELETE", "/posts/{postId}/hidden", doc(
                "게시글 관심 없음을 취소합니다.",
                "Path `postId`를 전달합니다.",
                "최종 `hidden=false`를 반환합니다.",
                "post_hidden_preferences 관계 행을 실제 삭제하며 이미 취소된 상태에서도 성공합니다.",
                DB_TRANSACTION,
                "`404 POST_NOT_FOUND`"
        ));
        add(docs, "GET", "/posts/following", doc(
                "로그인 회원이 팔로우 중인 작성자의 공개 게시글을 조회합니다.",
                "선택적인 `cursor`, `size`, `sort`를 사용합니다.",
                "개인 좋아요·북마크 상태를 포함한 게시글 페이지를 반환합니다.",
                "PUBLISHED만 대상으로 하고 차단 회원과 관심 없음 게시글을 제외합니다. LATEST 또는 POPULAR 정렬을 적용합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR/INVALID_REQUEST`"
        ));
        add(docs, "GET", "/users/me/posts", doc(
                "로그인 회원이 작성한 게시글을 조회합니다.",
                "선택적인 `cursor`, `size`, `status`(`ALL`, `PUBLISHED`, `HIDDEN`)를 사용합니다.",
                "본인 게시글 페이지와 상태를 반환합니다.",
                "관리자에 의해 HIDDEN 처리된 게시글도 본인에게는 노출합니다. DELETED는 일반 본인 목록에서 제외합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR/INVALID_REQUEST`"
        ));
        add(docs, "GET", "/users/{userId}/posts", doc(
                "다른 회원이 작성한 공개 게시글을 조회합니다. 인증은 선택입니다.",
                "Path `userId`, 선택적인 `cursor`, `size`를 사용합니다.",
                "대상 회원의 PUBLISHED 게시글 페이지를 반환하며 로그인 시 개인 상태를 포함합니다.",
                "본인 userId 요청은 내 게시글 전용 API 사용 오류를 반환합니다. 차단 관계이면 404입니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`, `404 USER_NOT_FOUND`, `409 USE_MY_POSTS_ENDPOINT`"
        ));
        add(docs, "GET", "/users/me/bookmarked-posts", doc(
                "로그인 회원이 북마크한 공개 게시글을 북마크 최신순으로 조회합니다.",
                "선택적인 `cursor`, `size`를 사용합니다.",
                "개인화 상태를 포함한 게시글 페이지를 반환합니다.",
                "현재 PUBLISHED인 게시글만 반환하고 차단 관계인 작성자의 게시글은 제외합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`"
        ));
        add(docs, "POST", "/posts/search", doc(
                "텍스트 또는 이미지 임베딩으로 게시글 이미지를 검색합니다.",
                "본문의 `textQuery`, 업로드 완료된 `imageObjectKey` 중 하나 이상을 전달하고 Query `cursor`, `size`를 사용합니다.",
                "검색 결과별 postImageId, postId, imageUrl, authorId와 검색 점수를 포함한 페이지를 반환할 예정입니다.",
                "두 입력을 함께 전달할 수 있으며 검색 결합·순위 계산은 백엔드 검색 서비스가 담당합니다. 차단·관심 없음·PUBLISHED 필터를 적용합니다.",
                "검색·임베딩·MinIO 호출은 외부 작업이며 DB는 읽기만 합니다. 현재 검색 서비스 연결 전이라 501을 반환합니다.",
                "`400 SEARCH_INPUT_REQUIRED/INVALID_CURSOR`, 공통 이미지 오류, `501 FEATURE_NOT_IMPLEMENTED`"
        ));

        add(docs, "GET", "/posts/{postId}/comments", doc(
                "게시글의 최상위 댓글을 최신순 또는 좋아요순으로 조회합니다. 인증은 선택입니다.",
                "Path `postId`, 선택적인 `cursor`, `size`, `sort`(`LATEST`, `POPULAR`)를 사용합니다.",
                "댓글 작성자, 내용, 상태, likeCount, replyCount와 로그인 사용자의 liked를 반환합니다. previewReplies는 반환하지 않습니다.",
                "DELETED 댓글과 대댓글은 일반 목록에서 제외하고 차단 작성자 댓글도 제외합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR/INVALID_REQUEST`, `404 POST_NOT_FOUND`"
        ));
        add(docs, "GET", "/comments/{commentId}/replies", doc(
                "최상위 댓글에 달린 한 단계 답글을 오래된 순서로 조회합니다. 인증은 선택입니다.",
                "Path `commentId`, 선택적인 `cursor`, `size`를 사용합니다.",
                "PUBLISHED 답글 페이지와 개인 좋아요 상태를 반환합니다.",
                "최상위 댓글에 대해서만 호출할 수 있으며 답글의 답글은 지원하지 않습니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR/REPLY_PARENT_REQUIRED`, `404 COMMENT_NOT_FOUND/POST_NOT_FOUND`"
        ));
        add(docs, "POST", "/posts/{postId}/comments", doc(
                "게시글에 댓글 또는 한 단계 답글을 작성합니다.",
                "`content`를 필수로 전달하고 답글이면 최상위 `parentCommentId`를 함께 전달합니다.",
                "`201 Created`와 생성된 댓글 정보를 반환합니다.",
                "부모 댓글은 같은 게시글에 속한 PUBLISHED 최상위 댓글이어야 하며 대대댓글은 허용하지 않습니다.",
                "comments 행 생성과 posts.comment_count 증가를 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 REPLY_DEPTH_EXCEEDED/INVALID_REQUEST`, `404 POST_NOT_FOUND/PARENT_COMMENT_NOT_FOUND`, `409 COMMENT_POST_MISMATCH`"
        ));
        add(docs, "DELETE", "/comments/{commentId}", doc(
                "본인 댓글을 소프트 삭제합니다.",
                "Path `commentId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "답글 자체를 삭제하면 해당 행만 DELETED로 변경합니다. 최상위 댓글을 삭제하면 그 댓글과 모든 직속 대댓글을 DELETED로 변경하되 본문과 comment_likes 이력은 보존합니다. 반복 요청은 카운트를 다시 감소시키지 않습니다.",
                "삭제 대상 댓글·대댓글 상태 변경과 실제 변경 행 수만큼 posts.comment_count 감소를 하나의 DB 트랜잭션으로 처리합니다.",
                "`403 COMMENT_DELETE_FORBIDDEN`, `404 COMMENT_NOT_FOUND`"
        ));
        add(docs, "POST", "/comments/{commentId}/like", doc(
                "댓글에 좋아요를 설정합니다.",
                "Path `commentId`를 전달합니다.",
                "최종 `liked=true`와 최신 likeCount를 반환합니다.",
                "PUBLISHED 댓글만 가능하며 반복 요청은 멱등합니다.",
                "comment_likes 관계 생성과 comments.like_count 증가를 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 COMMENT_NOT_FOUND/POST_NOT_FOUND`"
        ));
        add(docs, "DELETE", "/comments/{commentId}/like", doc(
                "댓글 좋아요를 취소합니다.",
                "Path `commentId`를 전달합니다.",
                "최종 `liked=false`와 최신 likeCount를 반환합니다.",
                "관계 행을 실제 삭제하며 이미 취소된 상태에서도 카운트를 다시 감소시키지 않습니다.",
                "comment_likes 관계 삭제와 comments.like_count 감소를 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 COMMENT_NOT_FOUND/POST_NOT_FOUND`"
        ));
    }

    private static void dmAndNotifications(Map<String, OperationDoc> docs) {
        add(docs, "GET", "/dm/rooms", doc(
                "로그인 회원에게 현재 활성화된 1:1 채팅방을 최근 메시지 순으로 조회합니다.",
                "선택적인 `cursor`, `size`를 사용합니다.",
                "상대 회원, 마지막으로 보이는 메시지, 안 읽은 개수, `notificationMuted`, 채팅방 시각을 포함한 페이지를 반환합니다.",
                "내 participant의 is_active=true인 방만 노출하고 차단 관계는 제외합니다. last_hidden_message_id 이하 메시지는 마지막 메시지·미읽음 계산에서도 제외합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`"
        ));
        add(docs, "POST", "/dm/rooms", doc(
                "상대 회원과의 1:1 채팅방을 생성하거나 기존 방에 다시 진입합니다.",
                "본문에 `otherUserId`를 전달합니다.",
                "새 방이면 `201 Created`, 기존 방이면 `200 OK`와 채팅방 정보를 반환합니다.",
                "두 회원 조합은 하나의 방만 가집니다. 기존 방 재진입 시 요청자 participant를 활성화하지만 이전 last_hidden_message_id 경계는 유지합니다.",
                "새 dm_rooms와 양쪽 participant 생성 또는 기존 participant 재활성화를 하나의 DB 트랜잭션으로 처리합니다.",
                "`404 USER_NOT_FOUND`, `409 CANNOT_DM_SELF/DM_BLOCKED`"
        ));
        add(docs, "DELETE", "/dm/rooms/{dmRoomId}", doc(
                "로그인 회원만 해당 채팅방에서 나간 상태로 변경합니다.",
                "Path `dmRoomId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "메시지와 방을 실제 삭제하지 않습니다. participant.is_active=false, last_left_at을 기록하고 현재 마지막 메시지 ID를 숨김 경계로 저장합니다.",
                "participant 활성 상태·숨김 경계·마지막 나간 시각을 하나의 DB 트랜잭션으로 변경합니다.",
                "`404 DM_ROOM_NOT_FOUND`, `403 NOT_DM_PARTICIPANT`"
        ));
        add(docs, "GET", "/dm/rooms/{dmRoomId}/notification-mute", doc(
                "로그인 회원의 해당 DM 방 알림 끄기 상태를 조회합니다.",
                "Path `dmRoomId`를 전달합니다.",
                "`dmRoomId`, `notificationMuted`, 설정 생성 시각인 `updatedAt`을 반환합니다. 켜진 상태이면 updatedAt은 null입니다.",
                "dm_room_notification_mutes 행이 존재하면 알림이 꺼진 상태입니다. 방을 나갔다가 새 메시지로 다시 활성화해도 설정은 유지됩니다.",
                READ_ONLY,
                "`403 NOT_DM_PARTICIPANT`, `404 DM_ROOM_NOT_FOUND`"
        ));
        add(docs, "POST", "/dm/rooms/{dmRoomId}/notification-mute", doc(
                "해당 DM 방의 알림 목록 저장과 푸시 발송을 끕니다.",
                "Path `dmRoomId`를 전달합니다.",
                "`notificationMuted=true`와 설정 시각을 반환합니다.",
                "설정 행을 멱등 생성하고 기존 미확인 NEW_DM 알림을 즉시 읽음 처리합니다. 이후 메시지는 dm_messages에 계속 저장되지만 해당 방 알림 행·푸시는 만들지 않습니다.",
                "음소거 행 생성과 기존 방 알림 읽음 처리를 하나의 DB 트랜잭션으로 처리합니다.",
                "`403 NOT_DM_PARTICIPANT`, `404 DM_ROOM_NOT_FOUND`"
        ));
        add(docs, "DELETE", "/dm/rooms/{dmRoomId}/notification-mute", doc(
                "해당 DM 방의 알림을 다시 받도록 설정합니다.",
                "Path `dmRoomId`를 전달합니다.",
                "`notificationMuted=false`와 변경 시각을 반환합니다.",
                "음소거 행을 멱등 삭제하며 해제 이후 도착하는 새 메시지부터 알림 행·푸시 대상이 됩니다.",
                DB_TRANSACTION,
                "`403 NOT_DM_PARTICIPANT`, `404 DM_ROOM_NOT_FOUND`"
        ));
        add(docs, "GET", "/dm/rooms/{dmRoomId}/messages", doc(
                "채팅방에서 로그인 회원에게 보이는 메시지를 커서 방식으로 조회합니다.",
                "Path `dmRoomId`, 선택적인 `cursor`, `size`를 사용합니다. 기본 size는 30, 최대 50입니다.",
                "숨김 경계 이후 메시지를 시간 순서로 반환하고 nextCursor는 더 오래된 메시지 조회에 사용합니다.",
                "채팅방 나가기 전 메시지는 계속 숨기며 새 메시지로 방이 재활성화되어도 경계를 되돌리지 않습니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`, `404 DM_ROOM_NOT_FOUND`, `403 NOT_DM_PARTICIPANT`"
        ));
        add(docs, "POST", "/dm/rooms/{dmRoomId}/messages", doc(
                "채팅방에 TEXT, IMAGE 또는 TEXT_WITH_IMAGE 메시지를 전송합니다.",
                "Path `dmRoomId`와 messageType에 맞는 `textContent`, 업로드 완료된 `imageObjectKey`를 전달합니다.",
                "`201 Created`와 저장된 메시지 및 이미지 조회 URL을 반환합니다.",
                "이미지는 images 테이블을 거치지 않고 dm_messages.image_key에 저장합니다. 새 메시지는 양쪽 participant를 재활성화하되 기존 숨김 경계를 유지합니다. 상대 방 알림이 켜져 있으면 고정 제목과 본문 앞 20자 미리보기(초과 시 ...)로 NEW_DM 알림을 생성합니다.",
                "MinIO 이미지 검증은 외부 작업입니다. 메시지 저장, 방 last_message_at 갱신, 양쪽 participant 재활성화, 조건부 알림 저장을 하나의 DB 트랜잭션으로 처리하고 외부 푸시는 커밋 후 호출합니다.",
                "`400 INVALID_REQUEST`, `403 NOT_DM_PARTICIPANT`, `404 DM_ROOM_NOT_FOUND`, `409 DM_BLOCKED`, 공통 이미지 오류"
        ));
        add(docs, "PATCH", "/dm/rooms/{dmRoomId}/read", doc(
                "지정한 메시지까지 상대가 보낸 읽지 않은 메시지를 읽음 처리합니다.",
                "Path `dmRoomId`와 `lastReadMessageId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "다른 채팅방 메시지는 기준으로 사용할 수 없습니다. 내 last_hidden_message_id 이하의 과거 메시지는 변경하지 않습니다.",
                "조건에 맞는 여러 dm_messages.read_at 변경과 같은 방의 미확인 NEW_DM 알림 읽음 처리를 하나의 DB 트랜잭션으로 처리합니다.",
                "`400 MESSAGE_ROOM_MISMATCH`, `403 NOT_DM_PARTICIPANT`, `404 DM_ROOM_NOT_FOUND/MESSAGE_NOT_FOUND`"
        ));
        add(docs, "GET", "/notifications/unread-counts", doc(
                "로그인 회원의 미확인 알림 행 개수를 유형별로 조회합니다.",
                "별도 입력이 없습니다.",
                "그룹화 전 총개수 `totalCount`와 `counts.NEW_DM`, `counts.SYSTEM`을 반환합니다.",
                "DM 방 음소거로 생성되지 않은 알림은 당연히 포함되지 않으며 차단 관계 actor의 알림도 제외합니다.",
                READ_ONLY,
                "인증 공통 오류"
        ));
        add(docs, "GET", "/notifications/unread/preview", doc(
                "헤더·배지 등에 사용할 최신 미확인 알림 그룹 최대 10개를 조회합니다.",
                "별도 입력이 없습니다.",
                "SYSTEM은 각 행을 count=1로, NEW_DM은 referenceId인 DM 방별로 묶어 최신 알림의 actorId·title·body·createdAt과 미확인 count를 반환합니다. `unreadCount`는 그룹화 전 행 총개수입니다.",
                "SYSTEM과 DM 그룹을 같은 목록에 섞어 최신 시각순으로 정렬합니다. 조회만으로 읽음 처리하지 않습니다.",
                READ_ONLY,
                "인증 공통 오류"
        ));
        add(docs, "GET", "/notifications/unread", doc(
                "로그인 회원의 전체 미확인 알림을 그룹화하여 커서 페이지로 조회합니다.",
                "선택적인 `cursor`, `size`를 사용합니다.",
                "preview와 동일한 항목 구조, `nextCursor`, `hasNext`, 그룹화 전 `unreadCount`를 반환합니다.",
                "SYSTEM은 개별 행, NEW_DM은 방별 하나의 항목입니다. 그룹 대표 시각과 notificationId를 복합 커서로 사용하며 차단 관계 알림은 제외합니다.",
                READ_ONLY,
                "`400 INVALID_CURSOR`"
        ));
        add(docs, "PATCH", "/notifications/{notificationId}/read", doc(
                "로그인 회원이 수신한 알림 한 건을 읽음 처리합니다.",
                "Path `notificationId`를 전달합니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "is_read=true와 read_at을 기록합니다. 다른 회원의 알림은 조회·변경할 수 없습니다.",
                DB_TRANSACTION,
                "`404 NOTIFICATION_NOT_FOUND`"
        ));
        add(docs, "PATCH", "/notifications/read-all", doc(
                "로그인 회원의 모든 읽지 않은 알림을 한 번에 읽음 처리합니다.",
                "별도 입력이 없습니다.",
                "성공 시 `204 No Content`를 반환합니다.",
                "이미 모두 읽은 상태에서도 성공하며 모든 대상 행에 같은 readAt을 기록합니다.",
                "현재 사용자의 모든 미확인 알림 변경을 하나의 DB 트랜잭션으로 처리합니다.",
                "인증 공통 오류"
        ));
    }

    private static void admin(Map<String, OperationDoc> docs) {
        add(docs, "GET", "/admin/reported-posts", doc(
                "신고가 접수된 게시글을 게시글 단위로 묶어 관리자 감사 목록으로 조회합니다.",
                "Query `status`(`PENDING`, `ACCEPTED`, `REJECTED`; 기본 PENDING), `sort`(`LATEST`, `MOST_REPORTED`; 기본 LATEST), 1부터 시작하는 `page`, `size`를 사용합니다.",
                "게시글 상태·작성자, 전체 신고 수, 선택 상태 신고 수, 최근 신고 시각과 신고 상세 배열을 반환합니다. 썸네일이나 이미지 URL은 반환하지 않습니다. 페이지 메타데이터는 page, size, totalElements, totalPages, hasPrevious, hasNext입니다.",
                "결과는 postId 단위입니다. LATEST는 선택 상태 신고의 최근 생성 시각, MOST_REPORTED는 posts.report_count 내림차순이며 동률은 postId 내림차순입니다. PUBLISHED, HIDDEN, DELETED를 모두 감사 대상으로 노출합니다.",
                READ_ONLY,
                "`400 INVALID_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`"
        ));
        add(docs, "PATCH", "/admin/reported-posts/{postId}", doc(
                "게시글에 남아 있는 모든 PENDING 신고를 한 번에 승인 또는 반려합니다.",
                "Path `postId`, 본문의 `decision`(`ACCEPTED` 또는 `REJECTED`), 선택적인 `processingNote`(최대 1000자)를 전달합니다.",
                "적용한 결정, 처리된 신고 수, 처리 후 게시글 상태, 메모와 처리 시각을 반환합니다.",
                "ACCEPTED이면 신고 전체를 승인하고 게시글을 HIDDEN으로 변경합니다. 이미 DELETED인 게시글은 DELETED를 유지합니다. REJECTED이면 신고만 반려합니다. 각 신고자에게 referenceType=REPORT, referenceId=자신의 reportId인 SYSTEM 알림을 저장합니다.",
                "대상 PENDING 신고 상태·메모·시각, 조건부 게시글 숨김, 신고자 알림 저장을 하나의 DB 트랜잭션으로 처리합니다. 외부 푸시는 커밋 후 호출합니다.",
                "`400 REPORT_DECISION_INVALID`, `404 POST_NOT_FOUND`, `409 NO_PENDING_REPORTS`"
        ));
        add(docs, "GET", "/admin/training/images", doc(
                "아직 모델 학습에 사용하지 않은 이미지 메타데이터를 조회합니다.",
                "1부터 시작하는 `page`와 `size`를 사용합니다. 정렬은 createdAt 내림차순, imageId 내림차순으로 고정합니다.",
                "imageId, DB에 영구 저장된 MinIO `objectKey`, isUsedForTraining=false, trainedAt=null, createdAt과 페이지 메타데이터를 반환합니다. 만료되는 imageUrl은 반환하지 않습니다.",
                "images.is_used_for_training=false인 모든 출처의 이미지를 대상으로 합니다. objectKey는 관리자 학습 작업이 MinIO 객체를 식별할 때 사용하며 공개 URL로 취급하지 않습니다.",
                READ_ONLY,
                "`400 INVALID_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`"
        ));
        add(docs, "PATCH", "/admin/training/images/complete", doc(
                "모델 학습이 끝난 이미지들을 학습 완료 상태로 일괄 변경합니다.",
                "중복 없는 `imageIds`를 1개 이상 1000개 이하로 전달합니다.",
                "이번 요청에서 변경한 ID와 이미 완료되어 유지한 ID, 각 개수, 최종 상태와 이번 변경 시각을 반환합니다.",
                "모든 ID의 존재를 먼저 검증합니다. 미학습 행만 is_used_for_training=true와 동일한 trained_at을 기록하고, 이미 완료된 행의 기존 trained_at은 바꾸지 않아 반복 요청의 멱등성을 보장합니다.",
                "모든 대상 이미지 행에 쓰기 잠금을 걸고 존재 확인과 학습 상태 변경을 하나의 DB 트랜잭션으로 처리합니다. 하나라도 없으면 어떤 행도 변경하지 않고 전체를 롤백합니다.",
                "`400 IMAGE_IDS_INVALID/IMAGE_IDS_DUPLICATED`, `404 IMAGE_NOT_FOUND`"
        ));
        add(docs, "PATCH", "/admin/artists/{userId}/approval-status", doc(
                "타투이스트 회원의 승인 상태와 관련 사유·승인 시각을 변경합니다.",
                "Path `userId`, 본문의 `approvalStatus`(`UNVERIFIED`, `PENDING`, `ASPIRING`, `VERIFIED`, `REJECTED`)와 조건부 `rejectionReason`을 전달합니다.",
                "변경 후 승인 상태, 거절 사유, 승인 시각과 수정 시각을 반환합니다.",
                "VERIFIED로 새 전환할 때만 approvedAt을 기록합니다. REJECTED는 사유가 필수이고 approvedAt을 지웁니다. 실제 변경 시 타투이스트 회원에게 referenceType=ARTIST, referenceId=userId인 SYSTEM 알림을 저장합니다.",
                "승인 상태·사유·시각과 조건부 알림 저장을 하나의 DB 트랜잭션으로 처리하고 외부 푸시는 커밋 후 호출합니다.",
                "`400 APPROVAL_STATUS_INVALID/REJECTION_REASON_REQUIRED/REJECTION_REASON_TOO_LONG`, `404 ARTIST_PROFILE_NOT_FOUND`"
        ));
    }

    private static OperationDoc doc(
            String overview,
            String request,
            String response,
            String rules,
            String transaction,
            String errors
    ) {
        return new OperationDoc(overview, request, response, rules, transaction, errors);
    }

    private static void add(
            Map<String, OperationDoc> docs,
            String method,
            String path,
            OperationDoc document
    ) {
        String key = method.toUpperCase() + " " + path;
        if (docs.putIfAbsent(key, document) != null) {
            throw new IllegalStateException("중복 Swagger 문서 키: " + key);
        }
    }

    private record OperationDoc(
            String overview,
            String request,
            String response,
            String rules,
            String transaction,
            String errors
    ) {
        String markdown() {
            return plain(overview)
                    + "\n\n**핵심 규칙**\n\n" + plain(rules)
                    + "\n\n**트랜잭션**\n\n" + transaction
                    + "\n\n**주요 오류**\n\n" + plain(errors);
        }
    }
}
