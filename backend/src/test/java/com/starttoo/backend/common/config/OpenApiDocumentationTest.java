package com.starttoo.backend.common.config;

import com.starttoo.backend.collection.api.CollectionController;
import com.starttoo.backend.collection.api.CollectionDtos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.models.responses.ApiResponses;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.core.annotation.AnnotatedElementUtils.hasAnnotation;

class OpenApiDocumentationTest {

    @Test
    void everyControllerAndEndpointHasDetailedOpenApiDocumentation() {
        List<Class<?>> controllers = controllers();
        assertThat(controllers).hasSize(21);
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

        assertThat(endpoints).hasSize(98);
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

    private Class<?> load(String className) {
        try {
            return Class.forName(className);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
