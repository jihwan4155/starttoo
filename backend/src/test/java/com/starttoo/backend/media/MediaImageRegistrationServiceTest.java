package com.starttoo.backend.media;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaImageRegistrationService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaImageRegistrationServiceTest {

    @Mock
    private ImageRepository imageRepository;

    @InjectMocks
    private MediaImageRegistrationService registrationService;

    @Test
    void existingObjectKeyIsDuplicate() {
        when(imageRepository.findByObjectKeyAndDeletedFalse("users/7/post/image.png"))
                .thenReturn(Optional.of(anyImage()));

        assertDuplicate(() -> registrationService.register(
                7,
                "users/7/post/image.png"
        ));

        verify(imageRepository, never()).saveAndFlush(any());
    }

    @Test
    void uniqueConstraintRaceIsDuplicate() {
        when(imageRepository.findByObjectKeyAndDeletedFalse("users/7/post/image.png"))
                .thenReturn(Optional.empty());
        when(imageRepository.saveAndFlush(any()))
                .thenThrow(new DataIntegrityViolationException("duplicate object_key"));

        assertDuplicate(() -> registrationService.register(
                7,
                "users/7/post/image.png"
        ));
    }

    private void assertDuplicate(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.DUPLICATE_RESOURCE));
    }

    private Image anyImage() {
        return Image.builder()
                .imageSeq(301L)
                .objectKey("users/7/post/image.png")
                .regUsrSeq(7)
                .modUsrSeq(7)
                .deleted(false)
                .build();
    }
}
