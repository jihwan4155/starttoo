package com.starttoo.backend.ai.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.starttoo.backend.ai.application.AiService;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI", description = "모델 연결 전 계약 검증용 AI API")
@SecurityRequirement(name = "bearerAuth")
public class AiController {

    private final AiService aiService;

    @PostMapping("/generations")
    @Operation(
            summary = "타투 이미지 생성",
            description = """
                    현재 모델 호출은 비활성화되어 있으며 입력 검증 후
                    MODEL_INTEGRATION_PENDING 모의 응답을 반환한다. 생성 요청과 결과 파일은
                    Starttoo DB에 저장하지 않는다. 추후 실제 결과를 사용자가 별도로 보관했다가
                    게시물로 등록하면 일반 이미지와 동일한 판별·분석 흐름을 거친다.
                    """
    )
    public ApiResponse<JsonNode> generate(
            @Valid @RequestBody AiDtos.GenerationRequest request
    ) {
        return ApiResponse.of(aiService.generate(request));
    }

    @PostMapping("/coverups")
    @Operation(
            summary = "커버업 이미지 생성",
            description = """
                    imageSeq가 현재 회원 소유의 활성 이미지인지 검증한다. 모델 호출과 MinIO
                    다운로드 URL 발급은 현재 비활성화되어 있고 MODEL_INTEGRATION_PENDING
                    모의 응답을 반환한다. 요청·응답은 DB에 저장하지 않는다.
                    """
    )
    public ApiResponse<JsonNode> coverup(
            @Valid @RequestBody AiDtos.CoverupRequest request
    ) {
        return ApiResponse.of(aiService.coverup(SecurityUtils.currentUserSeq(), request));
    }

    @PostMapping("/simulations")
    @Operation(
            summary = "신체 타투 시뮬레이션",
            description = """
                    신체 이미지와 타투 이미지가 모두 현재 회원 소유인지 확인한다. 각 이미지의
                    MinIO 단기 URL 발급과 모델 호출은 현재 비활성화되어 있으며 배치 입력 검증 후
                    MODEL_INTEGRATION_PENDING 모의 응답을 반환한다. 시뮬레이션 요청과 결과는
                    DB에 저장하지 않는다.
                    """
    )
    public ApiResponse<JsonNode> simulate(
            @Valid @RequestBody AiDtos.SimulationRequest request
    ) {
        return ApiResponse.of(aiService.simulate(SecurityUtils.currentUserSeq(), request));
    }
}
