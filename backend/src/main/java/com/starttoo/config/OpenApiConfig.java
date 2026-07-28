package com.starttoo.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI starttooOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Starttoo API")
                        .version("v1")
                        .description("""
                                타투 시뮬레이션·SNS 플랫폼 REST API입니다.

                                ### 인증
                                - bearerAuth가 표시된 API는 Authorization 헤더에 Access Token이 필요합니다.
                                - 인증 선택 API는 토큰 없이 호출할 수 있고, 토큰이 있으면 개인화 정보가 포함됩니다.

                                ### 응답과 오류
                                - 성공은 2xx와 리소스 JSON, 본문 없는 성공은 204 No Content를 사용합니다.
                                - 오류는 status, code, message와 선택적인 errors 배열로 반환합니다.

                                ### 페이지네이션
                                - 일반 목록은 cursor와 nextCursor를 사용합니다.
                                - 관리자 목록은 1부터 시작하는 page를 사용하며 원하는 페이지로 바로 이동할 수 있습니다.

                                ### 이미지 업로드
                                - 클라이언트가 Presigned PUT URL로 MinIO에 직접 업로드한 뒤 도메인 API에 objectKey를 전달합니다.
                                - DB에는 objectKey만 저장하고 조회 응답에는 만료되는 Presigned GET URL을 반환합니다.

                                ### 트랜잭션
                                - 관련 DB 변경은 하나의 요청 안에서 모두 커밋되거나 모두 롤백됩니다.
                                - MinIO, OAuth 제공자, FastAPI·AI 모델, 푸시 발송 같은 외부 시스템은 MySQL 트랜잭션에 포함되지 않습니다. 외부 작업과 DB 변경의 보상·재시도 정책은 별도로 적용합니다.
                                """))
                .servers(java.util.List.of(new Server().url("/v1").description("API v1")))
                .components(new Components().addSecuritySchemes(
                        "bearerAuth",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                ));
    }
}
