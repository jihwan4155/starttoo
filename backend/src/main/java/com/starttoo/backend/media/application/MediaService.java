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
import io.minio.StatObjectResponse;
import io.minio.errors.ErrorResponseException;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    private static final Set<String> EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Pattern OBJECT_KEY_PATTERN = Pattern.compile(
            "^users/(\\d+)/(profile|post|dm|collection|extraction)/"
                    + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                    + "\\.(jpg|png|webp)$"
    );

    private final MinioClient minioClient;
    private final MinioProperties properties;
    private final ImageRepository imageRepository;
    private final MediaImageRegistrationService imageRegistrationService;

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
        validateRequestedSize(request.fileSize());
        String extension = extension(request.originalFilename());
        validateContentType(extension, request.contentType(), ErrorCode.INVALID_FILE);
        ensureBucketOrThrow();
        String objectKey = "users/%d/%s/%s.%s".formatted(
                userSeq,
                request.purpose().name().toLowerCase(Locale.ROOT),
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
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public MediaDtos.ImageResponse complete(
            Integer userSeq,
            MediaDtos.CompleteUploadRequest request
    ) {
        String expectedContentType = validateOwnedObjectKey(userSeq, request.objectKey());
        ensureBucketOrThrow();
        StatObjectResponse stat;
        try {
            stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(request.objectKey())
                    .build());
        } catch (ErrorResponseException exception) {
            if (isMissingObject(exception)) {
                throw BusinessException.of(ErrorCode.UPLOAD_OBJECT_NOT_FOUND);
            }
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
        if (stat.size() <= 0) {
            throw BusinessException.of(ErrorCode.INVALID_FILE);
        }
        if (stat.size() > properties.maxImageBytes()) {
            throw BusinessException.of(ErrorCode.FILE_TOO_LARGE);
        }
        if (!expectedContentType.equals(stat.contentType())) {
            throw BusinessException.of(ErrorCode.UNSUPPORTED_MEDIA_TYPE);
        }

        PresignedDownload download = presignedDownload(request.objectKey());
        Image image = imageRegistrationService.register(userSeq, request.objectKey());
        return response(image, download);
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
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public record PresignedDownload(String url, OffsetDateTime expiresAt) {
    }

    private MediaDtos.ImageResponse response(Image image) {
        return response(image, presignedDownload(image.getObjectKey()));
    }

    private MediaDtos.ImageResponse response(Image image, PresignedDownload download) {
        return new MediaDtos.ImageResponse(
                image.getImageSeq(),
                image.getObjectKey(),
                download.url(),
                image.getRegDttm()
        );
    }

    private String extension(String filename) {
        if (filename.contains("/") || filename.contains("\\")) {
            throw BusinessException.of(ErrorCode.INVALID_FILE);
        }
        int index = filename.lastIndexOf('.');
        String value = index < 0 ? "" : filename.substring(index + 1).toLowerCase(Locale.ROOT);
        if (!EXTENSIONS.contains(value)) {
            throw BusinessException.of(ErrorCode.INVALID_FILE);
        }
        return value.equals("jpeg") ? "jpg" : value;
    }

    private void validateRequestedSize(Long fileSize) {
        if (fileSize == null || fileSize <= 0) {
            throw BusinessException.of(ErrorCode.INVALID_FILE);
        }
        if (fileSize > properties.maxImageBytes()) {
            throw BusinessException.of(ErrorCode.FILE_TOO_LARGE);
        }
    }

    private String validateOwnedObjectKey(Integer userSeq, String objectKey) {
        if (!objectKey.startsWith("users/" + userSeq + "/")) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        Matcher matcher = OBJECT_KEY_PATTERN.matcher(objectKey);
        if (!matcher.matches() || !matcher.group(1).equals(userSeq.toString())) {
            throw BusinessException.of(ErrorCode.INVALID_FILE);
        }
        return contentType(matcher.group(3));
    }

    private void validateContentType(
            String extension,
            String contentType,
            ErrorCode mismatchError
    ) {
        if (!contentType(extension).equals(contentType)) {
            throw BusinessException.of(mismatchError);
        }
    }

    private String contentType(String extension) {
        return switch (extension) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            default -> throw BusinessException.of(ErrorCode.INVALID_FILE);
        };
    }

    private boolean isMissingObject(ErrorResponseException exception) {
        if (exception.errorResponse() == null) {
            return false;
        }
        String code = exception.errorResponse().code();
        return "NoSuchKey".equals(code) || "NoSuchObject".equals(code);
    }

    private void ensureBucketOrThrow() {
        try {
            ensureBucketExists();
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
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
