package com.starttoo.backend.common.validation;

import com.starttoo.backend.ai.api.AiDtos;
import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.dm.api.DmDtos;
import com.starttoo.backend.post.api.PostDtos;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RequiredRequestFieldValidationTest {

    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void missingNumericAndBooleanInputsAreRejectedInsteadOfBecomingDefaults() {
        var collection = new CollectionDtos.CreateCollectionRequest(
                1L, "front", null, null, null, null, null
        );
        var simulation = new AiDtos.SimulationRequest(
                1L, 2L, "front", null, null, null, null, null
        );
        var dmNotification = new DmDtos.NotificationSettingRequest(null);
        var dwell = new PostDtos.DwellRequest(null);

        assertThat(validator.validate(collection)).hasSize(5);
        assertThat(validator.validate(simulation)).hasSize(5);
        assertThat(validator.validate(dmNotification)).hasSize(1);
        assertThat(validator.validate(dwell)).hasSize(1);
    }
}
