package com.starttoo.common.openapi;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DetailedOpenApiCustomizerTest {

    private final DetailedOpenApiCustomizer customizer = new DetailedOpenApiCustomizer();

    @Test
    void documentsEveryCurrentOperation() {
        assertThat(DetailedOpenApiCustomizer.documentedOperationCount()).isEqualTo(91);
        assertThat(DetailedOpenApiCustomizer.contains("POST", "/auth/signup/profile-image/presigned-url")).isTrue();
        assertThat(DetailedOpenApiCustomizer.contains("PUT", "/users/me/profile-image")).isTrue();
        assertThat(DetailedOpenApiCustomizer.contains("POST", "/posts/{postId}/like")).isTrue();
        assertThat(DetailedOpenApiCustomizer.contains("POST", "/dm/rooms/{dmRoomId}/messages")).isTrue();
        assertThat(DetailedOpenApiCustomizer.contains("POST", "/dm/rooms/{dmRoomId}/notification-mute")).isTrue();
        assertThat(DetailedOpenApiCustomizer.contains("GET", "/notifications/unread/preview")).isTrue();
        assertThat(DetailedOpenApiCustomizer.contains("GET", "/admin/reported-posts")).isTrue();
        assertThat(DetailedOpenApiCustomizer.contains("PATCH", "/admin/training/images/complete")).isTrue();
    }

    @Test
    void addsConciseSectionsAndParameterDescriptions() {
        Operation operation = new Operation()
                .addParametersItem(new Parameter().name("cursor"))
                .addParametersItem(new Parameter().name("size"));
        OpenAPI openAPI = new OpenAPI().paths(new Paths().addPathItem(
                "/posts",
                new PathItem().get(operation)
        ));

        customizer.customise(openAPI);

        assertThat(operation.getDescription())
                .contains("**핵심 규칙**", "**트랜잭션**", "**주요 오류**")
                .doesNotContain("**요청**", "**응답**", "`");
        assertThat(operation.getParameters().get(0).getDescription()).contains("nextCursor");
        assertThat(operation.getParameters().get(1).getDescription()).contains("1~50");
    }

    @Test
    void addsSuccessExampleToJsonResponse() {
        Schema<Object> responseSchema = new Schema<>();
        responseSchema.setType("object");
        responseSchema.addProperty("postId", new Schema<Long>().type("integer").format("int64"));
        responseSchema.addProperty("postStatus", new Schema<String>().type("string"));
        Operation operation = new Operation().responses(new ApiResponses().addApiResponse(
                "200",
                new ApiResponse().description("성공").content(new Content().addMediaType(
                        "application/json",
                        new MediaType().schema(responseSchema)
                ))
        ));
        OpenAPI openAPI = new OpenAPI().paths(new Paths().addPathItem(
                "/posts",
                new PathItem().get(operation)
        ));

        customizer.customise(openAPI);

        var examples = operation.getResponses().get("200").getContent()
                .get("application/json").getExamples();
        assertThat(operation.getResponses()).containsKeys("200", "400", "401", "403", "500");
        assertThat(examples).containsKey("success");
        assertThat(examples.get("success").getSummary()).isEqualTo("성공 응답");
        assertThat(examples.get("success").getValue().toString())
                .contains("postId", "postStatus", "PUBLISHED");
    }
}
