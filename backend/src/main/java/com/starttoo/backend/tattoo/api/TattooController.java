package com.starttoo.backend.tattoo.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.tattoo.application.TattooService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/tattoos")
@RequiredArgsConstructor
@Tag(name = "Tattoos", description = "분석 완료 타투 메타데이터")
public class TattooController {

    private final TattooService tattooService;

    @GetMapping("/{tattooSeq}")
    @OptionalAuth
    @Operation(
            summary = "타투 분석 결과 조회",
            description = """
                    활성 tattoos 행의 주 스타일 1개, 보조 스타일 최대 2개, 렌더링 스타일 최대
                    2개, 선택 색상과 다중 subject를 반환한다. 추가 학습 사용 여부와 학습 반영
                    시각도 함께 제공한다. 분류 seq를 그대로 노출하지 않고 기준정보를 조인해
                    스타일·색상은 code와 name, subject는 이름 문자열 목록으로 제공한다.
                    """
    )
    public ApiResponse<TattooDtos.TattooResponse> get(@PathVariable Long tattooSeq) {
        return ApiResponse.of(tattooService.get(tattooSeq));
    }

    @GetMapping("/{tattooSeq}/image")
    @OptionalAuth
    @Operation(
            summary = "타투 이미지 단기 URL 조회",
            description = """
                    ORIGINAL은 tattoos의 원본 imageSeq를, DESIGN은 활성 tattoo_designs의 가공
                    이미지 seq를 조회한다. 삭제되지 않은 이미지 object key로 단기 MinIO
                    Presigned GET URL을 생성하며 DESIGN이 없는 타투는 404를 반환한다.
                    """
    )
    public ApiResponse<TattooDtos.TattooImageResponse> image(
            @PathVariable Long tattooSeq,
            @Parameter(description = "조회할 이미지 종류", example = "ORIGINAL")
            @RequestParam TattooDtos.TattooImageVariant variant
    ) {
        return ApiResponse.of(tattooService.image(tattooSeq, variant));
    }
}
