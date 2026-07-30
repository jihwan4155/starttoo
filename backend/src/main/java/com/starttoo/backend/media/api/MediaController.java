package com.starttoo.backend.media.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.media.application.MediaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/images")
@RequiredArgsConstructor
@Tag(name = "Images", description = "MinIO presigned URL 이미지 업로드")
public class MediaController {

    private final MediaService mediaService;

    @PostMapping("/uploads/presign")
    @Operation(
            summary = "업로드용 presigned PUT URL 발급",
            description = """
                    purpose, 파일 크기, 파일명 확장자와 contentType 일치를 검증한다. 백엔드가
                    users/{userSeq}/{purpose}/{uuid}.{extension} MinIO objectKey를 생성하고,
                    클라이언트가 Content-Type 헤더와 함께 직접 PUT할 수 있는 단기 URL을
                    반환한다. 이 단계에서는 images 행을 만들지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<MediaDtos.PresignUploadResponse> presign(
            @Valid @RequestBody MediaDtos.PresignUploadRequest request
    ) {
        return ApiResponse.of(mediaService.presign(SecurityUtils.currentUserSeq(), request));
    }

    @PostMapping("/uploads/complete")
    @Operation(
            summary = "업로드 완료 확인 및 images 등록",
            description = """
                    objectKey의 회원·purpose·UUID·확장자 구조를 확인하고 MinIO stat으로 객체
                    존재, 실제 크기와 Content-Type 일치를 검증한다. 검증과 다운로드 URL 발급을
                    트랜잭션 없이 마친 후에만 짧은 images 등록 트랜잭션을 시작한다. DB 등록
                    실패로 남은 객체는 users/{userSeq}/{purpose}/ 아래에서 images.object_key가
                    없고 lastModified가 cleanup 실행 시각 - app.minio.upload-expiry보다 오래된
                    경우 orphan cleanup 대상으로 본다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<MediaDtos.ImageResponse> complete(
            @Valid @RequestBody MediaDtos.CompleteUploadRequest request
    ) {
        return ApiResponse.of(mediaService.complete(SecurityUtils.currentUserSeq(), request));
    }

    @GetMapping("/{imageSeq}")
    @Operation(
            summary = "이미지 단기 다운로드 URL 발급",
            description = """
                    소프트 삭제되지 않은 images 행을 조회하고 MinIO GET presigned URL을 발급한다.
                    영구 공개 URL을 저장하지 않으며 응답 URL은 설정된 짧은 만료시간 이후 사용할
                    수 없다.
                    """
    )
    public ApiResponse<MediaDtos.ImageResponse> get(@PathVariable Long imageSeq) {
        return ApiResponse.of(mediaService.get(imageSeq));
    }
}
