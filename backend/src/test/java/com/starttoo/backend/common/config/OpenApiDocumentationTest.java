package com.starttoo.backend.common.config;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.core.annotation.AnnotatedElementUtils.hasAnnotation;

class OpenApiDocumentationTest {

    @Test
    void everyControllerAndEndpointHasDetailedOpenApiDocumentation() {
        List<Class<?>> controllers = controllers();
        assertThat(controllers).hasSize(19);
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

        assertThat(endpoints).hasSize(86);
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
