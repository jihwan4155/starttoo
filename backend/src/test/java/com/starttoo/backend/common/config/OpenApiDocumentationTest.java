package com.starttoo.backend.common.config;

import com.starttoo.backend.collection.api.CollectionController;
import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.search.api.SearchController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.models.responses.ApiResponses;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.core.annotation.AnnotatedElementUtils.hasAnnotation;

class OpenApiDocumentationTest {

    private static final Set<String> EXPECTED_V1_ENDPOINTS = Set.of(
            "DELETE /v1/collections/{collectionSeq}",
            "DELETE /v1/comments/{commentSeq}",
            "DELETE /v1/devices/{deviceSeq}",
            "DELETE /v1/dm/rooms/{roomSeq}",
            "DELETE /v1/posts/{postSeq}",
            "DELETE /v1/users/me",
            "GET /v1/archive",
            "GET /v1/artists",
            "GET /v1/auth/nicknames/availability",
            "GET /v1/auth/nicknames/suggestions",
            "GET /v1/auth/phones/availability",
            "GET /v1/classifications/colors",
            "GET /v1/classifications/primary-styles",
            "GET /v1/classifications/rendering-styles",
            "GET /v1/classifications/secondary-styles",
            "GET /v1/collections",
            "GET /v1/comments/{commentSeq}/replies",
            "GET /v1/dm/rooms",
            "GET /v1/dm/rooms/{roomSeq}/messages",
            "GET /v1/notifications",
            "GET /v1/notifications/unread-counts",
            "GET /v1/posts",
            "GET /v1/posts/{postSeq}",
            "GET /v1/posts/{postSeq}/comments",
            "GET /v1/posts/bookmarked",
            "GET /v1/posts/following",
            "GET /v1/posts/me",
            "GET /v1/search/accounts",
            "GET /v1/search/accounts/autocomplete",
            "GET /v1/search/artists",
            "GET /v1/search/artists/autocomplete",
            "GET /v1/search/posts",
            "GET /v1/search/subjects/autocomplete",
            "GET /v1/tattoo-designs",
            "GET /v1/tattoos/{tattooSeq}",
            "GET /v1/tattoos/{tattooSeq}/image",
            "GET /v1/users/{userSeq}",
            "GET /v1/users/{userSeq}/collections",
            "GET /v1/users/{userSeq}/followers",
            "GET /v1/users/{userSeq}/following",
            "GET /v1/users/{userSeq}/posts",
            "GET /v1/users/me",
            "GET /v1/users/me/blocks",
            "GET /v1/users/me/recent-searches",
            "PATCH /v1/artists/me/profile",
            "PATCH /v1/dm/rooms/{roomSeq}/notification",
            "PATCH /v1/dm/rooms/{roomSeq}/read",
            "PATCH /v1/notifications/{notificationSeq}/read",
            "PATCH /v1/notifications/read-all",
            "PATCH /v1/posts/{postSeq}",
            "PATCH /v1/users/me",
            "PATCH /v1/users/me/profile-image",
            "PATCH /v1/users/me/recent-searches",
            "POST /v1/auth/logout",
            "POST /v1/auth/phone/verifications",
            "POST /v1/auth/phone/verifications/confirm",
            "POST /v1/auth/signup",
            "POST /v1/auth/social/login",
            "POST /v1/auth/token/refresh",
            "POST /v1/collections",
            "POST /v1/devices",
            "POST /v1/dm/rooms",
            "POST /v1/dm/rooms/{roomSeq}/messages",
            "POST /v1/images/uploads/complete",
            "POST /v1/images/uploads/presign",
            "POST /v1/posts",
            "POST /v1/posts/{postSeq}/comments",
            "POST /v1/posts/{postSeq}/dwell",
            "POST /v1/posts/{postSeq}/reports",
            "POST /v1/preferences/survey",
            "PUT /v1/archive/{tattooSeq}",
            "PUT /v1/comments/{commentSeq}/like",
            "PUT /v1/posts/{postSeq}/bookmark",
            "PUT /v1/posts/{postSeq}/like",
            "PUT /v1/posts/{postSeq}/not-interested",
            "PUT /v1/users/{userSeq}/block",
            "PUT /v1/users/{userSeq}/follow"
    );

    @Test
    void everyControllerAndEndpointHasDetailedOpenApiDocumentation() {
        List<Class<?>> controllers = controllers();
        assertThat(controllers).hasSize(16);
        assertThat(controllers).allSatisfy(controller -> {
            Tag tag = controller.getAnnotation(Tag.class);
            assertThat(tag)
                    .as("%s must have @Tag", controller.getSimpleName())
                    .isNotNull();
            assertThat(tag.description())
                    .as("%s tag description", controller.getSimpleName())
                    .isNotBlank();
        });

        List<Method> endpoints = controllers.stream()
                .flatMap(controller -> List.of(controller.getDeclaredMethods()).stream())
                .filter(method -> hasAnnotation(method, RequestMapping.class))
                .toList();

        assertThat(endpoints).hasSize(EXPECTED_V1_ENDPOINTS.size());
        assertThat(endpoints).allSatisfy(method -> {
            Operation operation = method.getAnnotation(Operation.class);
            assertThat(operation)
                    .as("%s#%s must have @Operation",
                            method.getDeclaringClass().getSimpleName(),
                            method.getName())
                    .isNotNull();
            assertThat(operation.summary()).isNotBlank();
            assertThat(operation.description()).isNotBlank();
        });

        assertThat(endpointSignatures(controllers))
                .containsExactlyInAnyOrderElementsOf(EXPECTED_V1_ENDPOINTS);
    }

    @Test
    void errorResponseAndNestedFieldViolationSchemasAreBothRegistered() {
        var openApi = new OpenApiConfig().starttooOpenApi();

        assertThat(openApi.getComponents().getSchemas())
                .containsKeys("ErrorResponse", "FieldViolation");
    }

    @Test
    void collectionCreateDocumentsTattooAnalysisFailures() throws Exception {
        Method method = CollectionController.class.getMethod(
                "create",
                CollectionDtos.CreateCollectionRequest.class
        );
        HandlerMethod handlerMethod = new HandlerMethod(
                new CollectionController(null),
                method
        );
        io.swagger.v3.oas.models.Operation operation =
                new io.swagger.v3.oas.models.Operation().responses(new ApiResponses());

        new OpenApiConfig().commonErrorResponses().customize(operation, handlerMethod);

        assertThat(operation.getResponses())
                .containsKeys("422", "502", "503", "504");
    }

    @Test
    void removedSearchEndpointsAreNotMapped() {
        List<String> paths = List.of(SearchController.class.getDeclaredMethods()).stream()
                .map(method -> org.springframework.core.annotation.AnnotatedElementUtils
                        .findMergedAnnotation(method, RequestMapping.class))
                .filter(java.util.Objects::nonNull)
                .flatMap(mapping -> List.of(mapping.value()).stream())
                .toList();

        assertThat(paths).doesNotContain(
                "/subjects/corrections",
                "/posts/{postSeq}/click"
        );
    }

    private List<Class<?>> controllers() {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        return scanner.findCandidateComponents("com.starttoo.backend").stream()
                .<Class<?>>map(definition -> load(definition.getBeanClassName()))
                .filter(controller -> !controller.isMemberClass())
                .filter(controller -> !controller.getSimpleName().equals("ErrorContractController"))
                .toList();
    }

    private Set<String> endpointSignatures(List<Class<?>> controllers) {
        return controllers.stream()
                .flatMap(controller -> {
                    RequestMapping classMapping = AnnotatedElementUtils
                            .findMergedAnnotation(controller, RequestMapping.class);
                    String basePath = mappingPaths(classMapping)[0];
                    return Arrays.stream(controller.getDeclaredMethods())
                            .map(method -> AnnotatedElementUtils.findMergedAnnotation(
                                    method,
                                    RequestMapping.class
                            ))
                            .filter(java.util.Objects::nonNull)
                            .flatMap(mapping -> Arrays.stream(mapping.method())
                                    .flatMap(httpMethod -> Arrays.stream(mappingPaths(mapping))
                                            .map(path -> httpMethod.name() + " " + basePath + path)));
                })
                .collect(Collectors.toSet());
    }

    private String[] mappingPaths(RequestMapping mapping) {
        if (mapping == null || mapping.path().length == 0) {
            return new String[]{""};
        }
        return mapping.path();
    }

    private Class<?> load(String className) {
        try {
            return Class.forName(className);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
