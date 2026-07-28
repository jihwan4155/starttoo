package com.starttoo.domain.generation.controller;

import com.starttoo.common.exception.FeatureNotImplementedException;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.generation.dto.GenerationDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@SecurityRequirement(name="bearerAuth")
public class GenerationController {
    private final AuthenticationFacade authenticationFacade;

    @Tag(name="AI Generation")
    @Operation(summary="AI 도안 동기 생성", description="FastAPI/모델 연결 전에는 501을 반환합니다. 참고 이미지는 objectKey로 전달합니다.")
    @PostMapping("/ai/generations")
    public AiGenerationResponse generate(@Valid @RequestBody AiGenerationRequest request) {
        authenticationFacade.requireUserId();
        throw new FeatureNotImplementedException();
    }

    @Tag(name="Coverup Recommendation")
    @Operation(summary="커버업 동기 추천", description="FastAPI/모델 연결 전에는 501을 반환합니다. 대상 이미지는 objectKey로 전달합니다.")
    @PostMapping("/coverups/recommendations")
    public CoverupResponse coverup(@Valid @RequestBody CoverupRequest request) {
        authenticationFacade.requireUserId();
        throw new FeatureNotImplementedException();
    }
}
