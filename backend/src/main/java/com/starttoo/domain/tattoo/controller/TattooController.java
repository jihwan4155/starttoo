package com.starttoo.domain.tattoo.controller;

import com.starttoo.common.exception.FeatureNotImplementedException;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.tattoo.dto.TattooDtos.*;
import com.starttoo.domain.tattoo.service.TattooService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name="Tattoos", description="타투 원본·도안 조회 및 도안 재생성")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/tattoos")
public class TattooController {
    private final TattooService tattooService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary="타투 상세 조회")
    @GetMapping("/{tattooId}")
    public TattooDetail detail(@PathVariable Long tattooId) {
        return tattooService.detail(authenticationFacade.optionalUserId().orElse(null), tattooId);
    }

    @Operation(summary="타투 원본 이미지 조회")
    @GetMapping("/{tattooId}/image")
    public TattooImageResponse image(@PathVariable Long tattooId) {
        return tattooService.image(authenticationFacade.optionalUserId().orElse(null), tattooId);
    }

    @Operation(summary="타투 도안 조회")
    @GetMapping("/{tattooId}/design")
    public TattooDesignResponse design(@PathVariable Long tattooId) {
        return tattooService.design(authenticationFacade.optionalUserId().orElse(null), tattooId);
    }

    @Operation(summary="타투 도안 동기 재생성·덮어쓰기", description="도안 가공 모델 연결 전에는 501을 반환합니다. 기존 도안이 있어도 성공 시 덮어씁니다.", security=@SecurityRequirement(name="bearerAuth"))
    @PostMapping("/{tattooId}/design")
    public TattooDesignResponse regenerate(@PathVariable Long tattooId) {
        tattooService.validateGenerationAccess(authenticationFacade.requireUserId(), tattooId);
        throw new FeatureNotImplementedException();
    }
}
