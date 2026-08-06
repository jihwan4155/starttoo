package com.starttoo.backend.media;

import com.starttoo.backend.common.config.MinioProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.api.MediaDtos;
import com.starttoo.backend.media.application.MediaImageRegistrationService;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.errors.ErrorResponseException;
import io.minio.errors.ServerException;
import io.minio.messages.ErrorResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MediaServiceTest {

    private static final String OBJECT_KEY =
            "users/7/post/123e4567-e89b-12d3-a456-426614174000.png";

    private MinioClient minioClient;
    private ImageRepository imageRepository;
    private MediaImageRegistrationService imageRegistrationService;
    private MediaService mediaService;

    @BeforeEach
    void setUp() throws Exception {
        minioClient = mock(MinioClient.class);
        imageRepository = mock(ImageRepository.class);
        imageRegistrationService = mock(MediaImageRegistrationService.class);
        mediaService = new MediaService(
                minioClient,
                // presign 전용 클라이언트 — 이 테스트는 내부 클라이언트 동작만 검증하므로 같은 목을 쓴다
                minioClient,
                new MinioProperties(
                        "http://localhost:9000",
                        "http://localhost:9000",
                        "starttoo",
                        "secret",
                        "starttoo",
                        15L * 1024 * 1024,
                        Duration.ofMinutes(10),
                        Duration.ofMinutes(10)
                ),
                imageRepository,
                imageRegistrationService
        );
        when(minioClient.bucketExists(any(BucketExistsArgs.class))).thenReturn(true);
    }

    @Test
    void presignBuildsPurposeKeyAndDoesNotRegisterImage() throws Exception {
        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("https://minio.example/upload");

        MediaDtos.PresignUploadResponse response = mediaService.presign(
                7,
                new MediaDtos.PresignUploadRequest(
                        MediaDtos.UploadPurpose.PROFILE,
                        "image/jpeg",
                        "profile.jpeg",
                        1024L
                )
        );

        assertThat(response.objectKey())
                .matches("users/7/profile/[0-9a-f-]{36}\\.jpg");
        assertThat(response.uploadUrl()).isEqualTo("https://minio.example/upload");
        assertThat(response.requiredHeaders()).containsEntry("Content-Type", "image/jpeg");
        verify(imageRegistrationService, never()).register(any(), any());
    }

    @Test
    void tattooDesignPresignUsesStableKeyForTheSourceImage() throws Exception {
        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("https://minio.example/upload");

        MediaService.PresignedUpload first =
                mediaService.presignTattooDesignUpload(7, 301L);
        MediaService.PresignedUpload retry =
                mediaService.presignTattooDesignUpload(7, 301L);

        assertThat(first.objectKey())
                .matches("users/7/extraction/[0-9a-f-]{36}\\.png");
        assertThat(retry.objectKey()).isEqualTo(first.objectKey());
        assertThat(first.url()).isEqualTo("https://minio.example/upload");
    }

    @Test
    void tattooDesignVerificationRejectsAKeyNotIssuedForTheSourceImage()
            throws Exception {
        assertError(
                () -> mediaService.verifyTattooDesignUpload(
                        7,
                        301L,
                        "users/7/extraction/123e4567-e89b-12d3-a456-426614174000.png"
                ),
                ErrorCode.INVALID_FILE
        );

        verify(minioClient, never()).statObject(any(StatObjectArgs.class));
    }

    @Test
    void presignRejectsExtensionAndMimeMismatch() {
        assertError(
                () -> mediaService.presign(
                        7,
                        new MediaDtos.PresignUploadRequest(
                                MediaDtos.UploadPurpose.POST,
                                "image/jpeg",
                                "tattoo.png",
                                1024L
                        )
                ),
                ErrorCode.INVALID_FILE
        );

        verify(imageRegistrationService, never()).register(any(), any());
    }

    @Test
    void presignRejectsDeclaredOversize() {
        assertError(
                () -> mediaService.presign(
                        7,
                        new MediaDtos.PresignUploadRequest(
                                MediaDtos.UploadPurpose.POST,
                                "image/png",
                                "tattoo.png",
                                16L * 1024 * 1024
                        )
                ),
                ErrorCode.FILE_TOO_LARGE
        );
    }

    @Test
    void completeRejectsTamperedUserPathBeforeMinioCall() throws Exception {
        assertError(
                () -> mediaService.complete(
                        7,
                        new MediaDtos.CompleteUploadRequest(
                                "users/8/post/123e4567-e89b-12d3-a456-426614174000.png"
                        )
                ),
                ErrorCode.FORBIDDEN
        );

        verify(minioClient, never()).statObject(any(StatObjectArgs.class));
        verify(imageRegistrationService, never()).register(any(), any());
    }

    @Test
    void completeRejectsMalformedOwnedObjectKey() throws Exception {
        assertError(
                () -> mediaService.complete(
                        7,
                        new MediaDtos.CompleteUploadRequest("users/7/../8/tattoo.png")
                ),
                ErrorCode.INVALID_FILE
        );

        verify(minioClient, never()).statObject(any(StatObjectArgs.class));
    }

    @Test
    void completeMapsMissingObjectToNotFound() throws Exception {
        ErrorResponseException exception = mock(ErrorResponseException.class);
        ErrorResponse errorResponse = mock(ErrorResponse.class);
        when(exception.errorResponse()).thenReturn(errorResponse);
        when(errorResponse.code()).thenReturn("NoSuchKey");
        when(minioClient.statObject(any(StatObjectArgs.class))).thenThrow(exception);

        assertError(
                () -> mediaService.complete(
                        7,
                        new MediaDtos.CompleteUploadRequest(OBJECT_KEY)
                ),
                ErrorCode.UPLOAD_OBJECT_NOT_FOUND
        );

        verify(imageRegistrationService, never()).register(any(), any());
    }

    @Test
    void completeRejectsActualMimeMismatch() throws Exception {
        StatObjectResponse stat = stat(1024L, "image/jpeg");
        when(minioClient.statObject(any(StatObjectArgs.class))).thenReturn(stat);

        assertError(
                () -> mediaService.complete(
                        7,
                        new MediaDtos.CompleteUploadRequest(OBJECT_KEY)
                ),
                ErrorCode.UNSUPPORTED_MEDIA_TYPE
        );

        verify(imageRegistrationService, never()).register(any(), any());
    }

    @Test
    void completeRejectsActualOversize() throws Exception {
        StatObjectResponse stat = stat(16L * 1024 * 1024, "image/png");
        when(minioClient.statObject(any(StatObjectArgs.class))).thenReturn(stat);

        assertError(
                () -> mediaService.complete(
                        7,
                        new MediaDtos.CompleteUploadRequest(OBJECT_KEY)
                ),
                ErrorCode.FILE_TOO_LARGE
        );

        verify(imageRegistrationService, never()).register(any(), any());
    }

    @Test
    void completePreservesDuplicateConflict() throws Exception {
        StatObjectResponse stat = stat(1024L, "image/png");
        when(minioClient.statObject(any(StatObjectArgs.class))).thenReturn(stat);
        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("https://minio.example/download");
        when(imageRegistrationService.register(7, OBJECT_KEY))
                .thenThrow(BusinessException.of(ErrorCode.DUPLICATE_RESOURCE));

        assertError(
                () -> mediaService.complete(
                        7,
                        new MediaDtos.CompleteUploadRequest(OBJECT_KEY)
                ),
                ErrorCode.DUPLICATE_RESOURCE
        );
    }

    @Test
    void completeMapsMinioConnectionFailureToServiceUnavailable() throws Exception {
        ServerException exception = mock(ServerException.class);
        when(minioClient.statObject(any(StatObjectArgs.class)))
                .thenThrow(exception);

        assertError(
                () -> mediaService.complete(
                        7,
                        new MediaDtos.CompleteUploadRequest(OBJECT_KEY)
                ),
                ErrorCode.SERVICE_UNAVAILABLE
        );

        verify(imageRegistrationService, never()).register(any(), any());
    }

    @Test
    void completeRegistersOnlyAfterValidationAndReturnsDownloadUrl() throws Exception {
        OffsetDateTime registeredAt = OffsetDateTime.now();
        Image image = Image.builder()
                .imageSeq(301L)
                .objectKey(OBJECT_KEY)
                .regDttm(registeredAt)
                .regUsrSeq(7)
                .modDttm(registeredAt)
                .modUsrSeq(7)
                .deleted(false)
                .build();
        StatObjectResponse stat = stat(1024L, "image/png");
        when(minioClient.statObject(any(StatObjectArgs.class))).thenReturn(stat);
        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn("https://minio.example/download");
        when(imageRegistrationService.register(7, OBJECT_KEY)).thenReturn(image);

        MediaDtos.ImageResponse response = mediaService.complete(
                7,
                new MediaDtos.CompleteUploadRequest(OBJECT_KEY)
        );

        assertThat(response.imageSeq()).isEqualTo(301L);
        assertThat(response.objectKey()).isEqualTo(OBJECT_KEY);
        assertThat(response.downloadUrl()).isEqualTo("https://minio.example/download");
        verify(imageRegistrationService).register(7, OBJECT_KEY);
    }

    private StatObjectResponse stat(long size, String contentType) {
        StatObjectResponse response = mock(StatObjectResponse.class);
        when(response.size()).thenReturn(size);
        when(response.contentType()).thenReturn(contentType);
        return response;
    }

    private void assertError(Runnable action, ErrorCode expected) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(expected));
    }
}
