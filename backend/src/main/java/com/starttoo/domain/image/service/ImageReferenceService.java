package com.starttoo.domain.image.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.domain.image.entity.ImageEntity;
import com.starttoo.domain.image.repository.ImageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ImageReferenceService {

    private final ImageRepository imageRepository;
    private final ObjectStoragePort objectStoragePort;

    @Transactional
    public ImageEntity register(String objectKey, Long userId) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        objectStoragePort.verifyUploadedObject(objectKey, userId);
        return imageRepository.findByObjectKey(objectKey).orElseGet(() -> {
            return imageRepository.save(ImageEntity.builder()
                    .objectKey(objectKey)
                    .build());
        });
    }

    @Transactional(readOnly = true)
    public String url(Long imageId) {
        ImageEntity image = imageRepository.findById(imageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESOURCE_NOT_FOUND));
        return objectStoragePort.createDownloadUrl(image.getObjectKey());
    }

    public String url(String objectKey) {
        return objectKey == null ? null : objectStoragePort.createDownloadUrl(objectKey);
    }
}
