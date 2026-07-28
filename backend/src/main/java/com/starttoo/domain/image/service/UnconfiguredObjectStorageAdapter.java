package com.starttoo.domain.image.service;

import com.starttoo.common.exception.FeatureNotImplementedException;
import org.springframework.stereotype.Component;

@Component
public class UnconfiguredObjectStorageAdapter implements ObjectStoragePort {

    @Override
    public PresignedUpload createUpload(
            String purpose,
            String contentType,
            long fileSize,
            Long userId
    ) {
        throw new FeatureNotImplementedException();
    }

    @Override
    public PresignedUpload createSignupUpload(
            String contentType,
            long fileSize,
            String oauthProvider,
            String oauthSubject
    ) {
        throw new FeatureNotImplementedException();
    }

    @Override
    public String createDownloadUrl(String objectKey) {
        if (objectKey == null) {
            return null;
        }
        throw new FeatureNotImplementedException();
    }

    @Override
    public void verifyUploadedObject(
            String objectKey,
            Long userId
    ) {
        throw new FeatureNotImplementedException();
    }

    @Override
    public void verifySignupUploadedObject(
            String objectKey,
            String oauthProvider,
            String oauthSubject
    ) {
        throw new FeatureNotImplementedException();
    }
}
