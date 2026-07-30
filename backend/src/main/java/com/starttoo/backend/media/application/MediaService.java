package com.starttoo.backend.media.application;

import com.starttoo.backend.common.config.MinioProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.api.MediaDtos;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.Http;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    private static final Set<String> EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");

    private final MinioClient minioClient;
    private final MinioProperties properties;
    private final ImageRepository imageRepository;

    @PostConstruct
    void ensureBucket() {
        try {
            ensureBucketExists();
        } catch (Exception exception) {
            log.warn("MinIO bucket initialization deferred: {}", exception.getMessage());
        }
    }

    public MediaDtos.PresignUploadResponse presign(
            Integer userSeq,
            MediaDtos.PresignUploadRequest request
    ) {
        ensureBucketOrThrow();
        String extension = extension(request.originalFilename());
        String objectKey = "users/%d/%d/%s.%s".formatted(
                userSeq,
                System.currentTimeMillis(),
                UUID.randomUUID(),
                extension
        );
        int expiry = Math.toIntExact(properties.uploadExpiry().toSeconds());
        try {
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Http.Method.PUT)
                            .bucket(properties.bucket())
                            .object(objectKey)
                            .expiry(expiry, TimeUnit.SECONDS)
                            .build()
            );
            return new MediaDtos.PresignUploadResponse(
                    objectKey,
                    url,
                    Map.of("Content-Type", request.contentType()),
                    expiry
            );
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    @Transactional
    public MediaDtos.ImageResponse complete(
            Integer userSeq,
            MediaDtos.CompleteUploadRequest request
    ) {
        ensureBucketOrThrow();
        if (!request.objectKey().startsWith("users/" + userSeq + "/")) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        imageRepository.findByObjectKeyAndDeletedFalse(request.objectKey())
                .ifPresent(image -> {
                    throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
                });
        try {
            var stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(request.objectKey())
                    .build());
            if (stat.size() <= 0 || stat.size() > properties.maxImageBytes()) {
                throw new BusinessException(ErrorCode.INVALID_FILE, "이미지 크기가 허용 범위를 벗어났습니다.");
            }
            if (stat.contentType() == null
                    || !stat.contentType().matches("image/(jpeg|png|webp)")) {
                throw new BusinessException(ErrorCode.INVALID_FILE, "지원하지 않는 이미지 미디어 타입입니다.");
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.INVALID_FILE, "업로드된 객체를 확인할 수 없습니다.");
        }
        OffsetDateTime now = OffsetDateTime.now();
        Image image = imageRepository.save(Image.builder()
                .objectKey(request.objectKey())
                .regDttm(now)
                .regUsrSeq(userSeq)
                .modDttm(now)
                .modUsrSeq(userSeq)
                .deleted(false)
                .build());
        return response(image);
    }

    @Transactional(readOnly = true)
    public MediaDtos.ImageResponse get(Long imageSeq) {
        Image image = imageRepository.findByImageSeqAndDeletedFalse(imageSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        return response(image);
    }

    public String downloadUrl(Image image) {
        return downloadUrl(image.getObjectKey());
    }

    public String downloadUrl(String objectKey) {
        return presignedDownload(objectKey).url();
    }

    public PresignedDownload presignedDownload(String objectKey) {
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(properties.downloadExpiry());
        try {
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Http.Method.GET)
                            .bucket(properties.bucket())
                            .object(objectKey)
                            .expiry(
                                    Math.toIntExact(properties.downloadExpiry().toSeconds()),
                                    TimeUnit.SECONDS
                            )
                            .build()
            );
            return new PresignedDownload(url, expiresAt);
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    public record PresignedDownload(String url, OffsetDateTime expiresAt) {
    }

    private MediaDtos.ImageResponse response(Image image) {
        return new MediaDtos.ImageResponse(
                image.getImageSeq(),
                image.getObjectKey(),
                downloadUrl(image),
                image.getRegDttm()
        );
    }

    private String extension(String filename) {
        int index = filename.lastIndexOf('.');
        String value = index < 0 ? "" : filename.substring(index + 1).toLowerCase(Locale.ROOT);
        if (!EXTENSIONS.contains(value)) {
            throw BusinessException.of(ErrorCode.INVALID_FILE);
        }
        return value.equals("jpeg") ? "jpg" : value;
    }

    private void ensureBucketOrThrow() {
        try {
            ensureBucketExists();
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
    }

    private void ensureBucketExists() throws Exception {
        if (!minioClient.bucketExists(
                BucketExistsArgs.builder().bucket(properties.bucket()).build())) {
            minioClient.makeBucket(
                    MakeBucketArgs.builder().bucket(properties.bucket()).build());
        }
    }
}
