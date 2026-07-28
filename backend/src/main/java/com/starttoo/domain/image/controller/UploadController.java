package com.starttoo.domain.image.controller;

import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.image.dto.UploadDtos.PresignedUploadRequest;
import com.starttoo.domain.image.dto.UploadDtos.PresignedUploadResponse;
import com.starttoo.domain.image.service.ObjectStoragePort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Uploads", description = "MinIO 직접 업로드용 Presigned URL")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/uploads")
public class UploadController {

    private final AuthenticationFacade authenticationFacade;
    private final ObjectStoragePort objectStoragePort;

    @Operation(summary = "Presigned 업로드 URL 발급", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/presigned-url")
    public ResponseEntity<PresignedUploadResponse> createPresignedUpload(
            @Valid @RequestBody PresignedUploadRequest request
    ) {
        var result = objectStoragePort.createUpload(
                request.purpose(),
                request.contentType(),
                request.fileSize(),
                authenticationFacade.requireUserId()
        );
        return ResponseEntity.ok(new PresignedUploadResponse(
                result.objectKey(),
                result.uploadUrl(),
                result.method(),
                result.contentType(),
                result.expiresAt()
        ));
    }
}
