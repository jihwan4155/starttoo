package com.starttoo.backend.coverup.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.coverup.application.CoverupSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/designs")
@RequiredArgsConstructor
@Tag(name = "Coverup Search", description = "커버업 도안 형태 검색")
public class CoverupSearchController {

    private final CoverupSearchService coverupSearchService;

    @PostMapping("/search-by-shape")
    @Operation(
            summary = "형태로 도안 검색",
            description = """
                    캔버스에 그린 마스크(검은 배경 + 흰 획 PNG)를 받아 닮은 도안을 검색 점수
                    내림차순으로 돌려준다. mode 는 coverup(안쪽까지 덮기) 또는 shape(선 형태)다.
                    삭제된 도안은 제외되므로 결과 수가 요청 수보다 적을 수 있다. 이미지는
                    Presigned GET URL 로 브라우저가 직접 받는다. 검색 엔진 장애 시 이 API 만 503 이다.
                    """
    )
    public ApiResponse<CoverupDtos.SearchResponse> searchByShape(
            @Valid @RequestBody CoverupDtos.SearchRequest request
    ) {
        return ApiResponse.of(coverupSearchService.search(request));
    }
}
