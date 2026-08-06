package com.starttoo.backend.media.application;

import com.starttoo.backend.common.config.MinioProperties;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.api.MediaDtos;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
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

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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
            "^users/(\\d+)/(profile|post|dm|collection|extraction|simulation)/"
                    + "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                    + "\\.(jpg|png|webp)$"
    );

    private final MinioClient minioClient;
    private final MinioClient minioPresignClient;
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
            String url = minioPresignClient.getPresignedObjectUrl(
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

    public String downloadUrl(Image image) {
        return downloadUrl(image.getObjectKey());
    }

    public String downloadUrl(String objectKey) {
        return presignedDownload(objectKey).url();
    }

    /**
     * AI 분류 과정에서 만들어지는 투명 PNG의 업로드 위치를 발급한다. 원본 이미지마다 같은
     * object key를 사용하므로 MinIO 업로드 후 DB 저장이 실패해도 재시도가 새 고아 객체를
     * 계속 만들지 않는다.
     */
    public PresignedUpload presignTattooDesignUpload(Integer userSeq, Long sourceImageSeq) {
        ensureBucketOrThrow();
        String objectKey = tattooDesignObjectKey(userSeq, sourceImageSeq);
        int expiry = Math.toIntExact(properties.uploadExpiry().toSeconds());
        try {
            String url = minioPresignClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Http.Method.PUT)
                            .bucket(properties.bucket())
                            .object(objectKey)
                            .expiry(expiry, TimeUnit.SECONDS)
                            .build()
            );
            return new PresignedUpload(objectKey, url);
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    /** AI가 백엔드가 지정한 위치에 정상적인 PNG를 저장했는지 DB 반영 전에 확인한다. */
    public void verifyTattooDesignUpload(
            Integer userSeq,
            Long sourceImageSeq,
            String objectKey
    ) {
        if (!tattooDesignObjectKey(userSeq, sourceImageSeq).equals(objectKey)) {
            throw BusinessException.of(ErrorCode.INVALID_FILE);
        }
        ensureBucketOrThrow();
        try {
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(objectKey)
                    .build());
            if (stat.size() <= 0) {
                throw BusinessException.of(ErrorCode.INVALID_FILE);
            }
            if (stat.size() > properties.maxImageBytes()) {
                throw BusinessException.of(ErrorCode.FILE_TOO_LARGE);
            }
            if (!"image/png".equals(stat.contentType())) {
                throw BusinessException.of(ErrorCode.UNSUPPORTED_MEDIA_TYPE);
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (ErrorResponseException exception) {
            if (isMissingObject(exception)) {
                throw BusinessException.of(ErrorCode.UPLOAD_OBJECT_NOT_FOUND);
            }
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public void verifyStoredObject(String objectKey) {
        ensureBucketOrThrow();
        try {
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(objectKey)
                    .build());
            if (stat.size() <= 0) {
                throw BusinessException.of(ErrorCode.INVALID_FILE);
            }
            if (stat.size() > properties.maxImageBytes()) {
                throw BusinessException.of(ErrorCode.FILE_TOO_LARGE);
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (ErrorResponseException exception) {
            if (isMissingObject(exception)) {
                throw BusinessException.of(ErrorCode.UPLOAD_OBJECT_NOT_FOUND);
            }
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public PresignedDownload presignedDownload(String objectKey) {
        return presignedDownload(objectKey, properties.downloadExpiry());
    }

    /**
     * 만료를 직접 지정해 Presigned GET URL 을 발급한다.
     * 결과 목록처럼 화면을 오래 열어두는 응답은 기본 만료보다 길게 잡아야 이미지가 깨지지 않는다.
     */
    public PresignedDownload presignedDownload(String objectKey, Duration expiry) {
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(expiry);
        try {
            String url = minioPresignClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Http.Method.GET)
                            .bucket(properties.bucket())
                            .object(objectKey)
                            .expiry(Math.toIntExact(expiry.toSeconds()), TimeUnit.SECONDS)
                            .build()
            );
            return new PresignedDownload(url, expiresAt);
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    /**
     * 서버 내부 처리용으로 객체 바이트를 읽는다.
     * 클라이언트 응답으로 이미지를 중계하는 용도가 아니다. 그건 Presigned URL 로 직접 받게 한다.
     */
    public byte[] objectBytes(String objectKey) {
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(properties.bucket())
                .object(objectKey)
                .build())) {
            return stream.readAllBytes();
        } catch (Exception exception) {
            throw BusinessException.of(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public record PresignedDownload(String url, OffsetDateTime expiresAt) {
    }

    public record PresignedUpload(String objectKey, String url) {
    }

    private String tattooDesignObjectKey(Integer userSeq, Long sourceImageSeq) {
        String seed = "tattoo-design:%d:%d".formatted(userSeq, sourceImageSeq);
        UUID stableId = UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8));
        return "users/%d/extraction/%s.png".formatted(userSeq, stableId);
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
