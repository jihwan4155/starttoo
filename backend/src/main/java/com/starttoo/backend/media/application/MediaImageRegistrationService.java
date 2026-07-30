package com.starttoo.backend.media.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class MediaImageRegistrationService {

    private final ImageRepository imageRepository;

    @Transactional
    public Image register(Integer userSeq, String objectKey) {
        imageRepository.findByObjectKeyAndDeletedFalse(objectKey)
                .ifPresent(image -> {
                    throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
                });
        OffsetDateTime now = OffsetDateTime.now();
        try {
            return imageRepository.saveAndFlush(Image.builder()
                    .objectKey(objectKey)
                    .regDttm(now)
                    .regUsrSeq(userSeq)
                    .modDttm(now)
                    .modUsrSeq(userSeq)
                    .deleted(false)
                    .build());
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }
    }
}
