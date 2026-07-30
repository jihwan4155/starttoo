package com.starttoo.backend.tattoo.api;

import com.starttoo.backend.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/classifications")
@RequiredArgsConstructor
@Tag(name = "Classifications", description = "현재 활성화된 타투 분석 기준정보")
public class ClassificationController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/primary-styles")
    @Operation(
            summary = "주 스타일 목록",
            description = "타투 분석과 취향 점수에 사용하는 활성 주 스타일 코드·표시명을 반환한다."
    )
    public ApiResponse<List<TattooDtos.ClassificationItem>> primaryStyles() {
        return ApiResponse.of(list("primary_styles", "primary_style_seq", "style_code", "style_name"));
    }

    @GetMapping("/secondary-styles")
    @Operation(
            summary = "보조 스타일 목록",
            description = "분석 결과에 최대 2개까지 연결할 수 있는 활성 보조 스타일을 반환한다."
    )
    public ApiResponse<List<TattooDtos.ClassificationItem>> secondaryStyles() {
        return ApiResponse.of(list("secondary_styles", "secondary_style_seq", "style_code", "style_name"));
    }

    @GetMapping("/rendering-styles")
    @Operation(
            summary = "렌더링 스타일 목록",
            description = "분석 결과에 최대 2개까지 연결할 수 있는 활성 렌더링 스타일을 반환한다."
    )
    public ApiResponse<List<TattooDtos.ClassificationItem>> renderingStyles() {
        return ApiResponse.of(list("rendering_styles", "rendering_style_seq", "style_code", "style_name"));
    }

    @GetMapping("/colors")
    @Operation(
            summary = "색상 목록",
            description = "타투의 선택 색상과 사용자 색상 취향 점수에 사용하는 활성 색상을 반환한다."
    )
    public ApiResponse<List<TattooDtos.ClassificationItem>> colors() {
        return ApiResponse.of(list("colors", "color_seq", "color_code", "color_name"));
    }

    private List<TattooDtos.ClassificationItem> list(
            String table,
            String seqColumn,
            String codeColumn,
            String nameColumn
    ) {
        return jdbcTemplate.query(
                "SELECT " + seqColumn + ", " + codeColumn + ", " + nameColumn
                        + " FROM " + table + " WHERE is_active = TRUE ORDER BY " + seqColumn,
                (rs, rowNum) -> new TattooDtos.ClassificationItem(
                        rs.getInt(seqColumn),
                        rs.getString(codeColumn),
                        rs.getString(nameColumn)
                )
        );
    }
}
