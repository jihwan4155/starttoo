package com.starttoo.backend.collection;

import com.starttoo.backend.collection.api.CollectionDtos;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CollectionDtoValidationTest {

    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void allCreateFieldsAreRequired() {
        CollectionDtos.CreateCollectionRequest request =
                new CollectionDtos.CreateCollectionRequest(
                        null, null, null, null, null, null, null
                );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains(
                        "imageSeq",
                        "bodyView",
                        "positionX",
                        "positionY",
                        "scaleRatio",
                        "rotationDegree",
                        "flipped"
                );
    }

    @Test
    void positionScaleAndRotationRangesAreValidated() {
        CollectionDtos.CreateCollectionRequest request =
                new CollectionDtos.CreateCollectionRequest(
                        301L,
                        "front",
                        -0.01,
                        1.01,
                        0.0,
                        180.01,
                        false
                );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactlyInAnyOrder(
                        "positionX",
                        "positionY",
                        "scaleRatio",
                        "rotationDegree"
                );
    }
}
