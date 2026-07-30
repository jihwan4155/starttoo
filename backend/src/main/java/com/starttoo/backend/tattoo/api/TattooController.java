package com.starttoo.backend.tattoo.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.tattoo.application.TattooService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/tattoos")
@RequiredArgsConstructor
@Tag(name = "Tattoos", description = "분석 완료 타투 메타데이터")
public class TattooController {

    private final TattooService tattooService;

    @GetMapping("/{tattooSeq}")
    @Operation(
            summary = "타투 분석 결과 조회",
            description = """
                    활성 tattoos 행의 주 스타일 1개, 보조 스타일 최대 2개, 렌더링 스타일 최대
                    2개, 선택 색상과 다중 subject를 반환한다. 추가 학습 사용 여부와 학습 반영
                    시각도 함께 제공한다.
                    """
    )
    public ApiResponse<TattooDtos.TattooResponse> get(@PathVariable Long tattooSeq) {
        return ApiResponse.of(tattooService.get(tattooSeq));
    }
}
