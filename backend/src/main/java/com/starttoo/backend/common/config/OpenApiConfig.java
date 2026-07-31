package com.starttoo.backend.common.config;

import com.starttoo.backend.common.error.ErrorResponse;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Configuration
public class OpenApiConfig {

    public static final String BEARER_AUTH = "bearerAuth";

    @Bean
    OpenAPI starttooOpenApi() {
        SecurityScheme bearerScheme = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT");
        Map<String, Schema> errorSchemas = ModelConverters.getInstance()
                .readAll(ErrorResponse.class);
        Components components = new Components()
                .addSecuritySchemes(BEARER_AUTH, bearerScheme);
        // 변경: ErrorResponse가 참조하는 FieldViolation까지 모두 등록한다.
        errorSchemas.forEach(components::addSchemas);
        return new OpenAPI()
                .info(new Info()
                        .title("Starttoo API")
                        .version("v1")
                        .description("""
                                타투이스트 중심 타투 추천·커뮤니티·DM 서비스 API입니다.
                                성공 응답은 `data`로 감싸며 실패 응답은 `status`, `code`,
                                `message`, `timestamp`와 선택적인 필드 오류를 반환합니다.
                                각 API 설명에는 데이터 검증과 트랜잭션 처리 범위를 함께 기재합니다.
                                현재 타투 판별·분석·생성 모델 호출은 비활성화되어 있으며, 모델
                                의존 API는 소유권·입력·DB 원자성 검증이 가능한 임시 응답을 사용합니다.
                                DM은 REST로 DB 트랜잭션을 확정한 뒤 `/ws` STOMP 연결의 개인
                                목적지로 실시간 전달합니다. WebSocket 구독 계약은 README와
                                `docs/API_SPEC.md`에 별도로 기재되어 있습니다.
                                """))
                .components(components);
    }

    @Bean
    OperationCustomizer commonErrorResponses() {
        return (operation, handlerMethod) -> {
            if (handlerMethod.hasMethodAnnotation(OptionalAuth.class)) {
                operation.setSecurity(List.of(
                        new io.swagger.v3.oas.models.security.SecurityRequirement(),
                        new io.swagger.v3.oas.models.security.SecurityRequirement()
                                .addList(BEARER_AUTH)
                ));
            }
            ApiResponses responses = operation.getResponses();
            addError(responses, "400", "요청 형식 또는 입력값 오류");
            if (requiresAuthentication(handlerMethod)) {
                addError(responses, "401", "Bearer JWT 누락·만료·위조");
                addError(responses, "403", "역할, 소유권, 차단 또는 계정 상태로 인한 접근 거부");
            }
            if (hasPathVariable(handlerMethod)) {
                addError(responses, "404", "요청한 리소스가 없거나 현재 사용자에게 노출되지 않음");
            }
            if (isMutation(handlerMethod)) {
                addError(responses, "409", "중복 요청 또는 현재 상태와 충돌");
            }
            if (usesMinio(handlerMethod)) {
                addError(responses, "503", "MinIO 연결 장애 또는 저장소 사용 불가");
                if (handlerMethod.getMethod().getName().equals("presign")) {
                    addError(responses, "413", "요청 파일 크기가 설정된 최대값을 초과함");
                }
                if (handlerMethod.getMethod().getName().equals("complete")) {
                    addError(responses, "404", "업로드 완료할 MinIO 객체가 없음");
                    addError(responses, "413", "실제 업로드 파일 크기가 설정된 최대값을 초과함");
                    addError(responses, "415", "object key 확장자와 실제 Content-Type이 일치하지 않음");
                }
            } else if (usesExternalService(handlerMethod)) {
                addError(responses, "502", "OAuth 또는 SMS 외부 서비스 처리 실패");
                addError(responses, "503", "필수 외부 서비스가 설정되지 않았거나 일시적으로 사용 불가");
                addError(responses, "504", "외부 서비스 처리 시간 초과");
            }
            if (handlerMethod.getBeanType().getSimpleName().equals("SearchController")) {
                addError(responses, "503", "Redis 검색 인덱스를 일시적으로 사용할 수 없음");
            }
            if (usesRecentSearchMutation(handlerMethod)) {
                addError(responses, "503", "Redis 장애로 최근 검색어를 변경할 수 없음");
            }
            addError(responses, "429", "요청 횟수 제한");
            addError(responses, "500", "서버 내부 오류");
            return operation;
        };
    }

    private boolean requiresAuthentication(
            org.springframework.web.method.HandlerMethod handlerMethod
    ) {
        Operation operation = handlerMethod.getMethodAnnotation(Operation.class);
        boolean methodSecurity = operation != null && operation.security().length > 0;
        return methodSecurity
                || handlerMethod.getMethod()
                .getAnnotationsByType(SecurityRequirement.class).length > 0
                || handlerMethod.getBeanType()
                .getAnnotationsByType(SecurityRequirement.class).length > 0;
    }

    private boolean hasPathVariable(
            org.springframework.web.method.HandlerMethod handlerMethod
    ) {
        return Arrays.stream(handlerMethod.getMethodParameters())
                .anyMatch(parameter -> parameter.hasParameterAnnotation(PathVariable.class));
    }

    private boolean isMutation(org.springframework.web.method.HandlerMethod handlerMethod) {
        return handlerMethod.hasMethodAnnotation(PostMapping.class)
                || handlerMethod.hasMethodAnnotation(PutMapping.class)
                || handlerMethod.hasMethodAnnotation(PatchMapping.class)
                || handlerMethod.hasMethodAnnotation(DeleteMapping.class);
    }

    private boolean usesExternalService(
            org.springframework.web.method.HandlerMethod handlerMethod
    ) {
        String controller = handlerMethod.getBeanType().getSimpleName();
        String method = handlerMethod.getMethod().getName();
        return controller.equals("AuthController")
                && (method.equals("socialLogin") || method.equals("requestPhoneVerification"));
    }

    private boolean usesMinio(org.springframework.web.method.HandlerMethod handlerMethod) {
        return handlerMethod.getBeanType().getSimpleName().equals("MediaController");
    }

    private boolean usesRecentSearchMutation(
            org.springframework.web.method.HandlerMethod handlerMethod
    ) {
        if (!handlerMethod.getBeanType().getSimpleName().equals("UserController")) {
            return false;
        }
        String method = handlerMethod.getMethod().getName();
        return method.equals("addRecentSearch") || method.equals("removeRecentSearch");
    }

    private void addError(ApiResponses responses, String status, String description) {
        if (responses.containsKey(status)) {
            return;
        }
        Schema<?> schema = new Schema<>().$ref(
                "#/components/schemas/ErrorResponse"
        );
        Content content = new Content().addMediaType(
                org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                new MediaType().schema(schema)
        );
        responses.addApiResponse(
                status,
                new io.swagger.v3.oas.models.responses.ApiResponse()
                        .description(description)
                        .content(content)
        );
    }
}
