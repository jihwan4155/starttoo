package com.starttoo.backend.preference.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/preferences")
@RequiredArgsConstructor
@Tag(name = "Preferences", description = "현재 취향 점수와 최초 설문")
@SecurityRequirement(name = "bearerAuth")
public class PreferenceController {

    private final PreferenceScoreService preferenceScoreService;

    @GetMapping
    @Operation(
            summary = "내 취향 점수 조회",
            description = """
                    추천에 사용하는 primaryStyle과 color별 현재 누적 점수를 각각 점수 내림차순으로
                    반환한다. secondaryStyle과 renderingStyle은 분석 메타데이터로만 유지되며
                    현재 취향 점수 계산에는 사용하지 않는다.
                    """
    )
    public ApiResponse<PreferenceDtos.Preferences> get() {
        return ApiResponse.of(preferenceScoreService.get(SecurityUtils.currentUserSeq()));
    }

    @PostMapping("/survey")
    @Operation(
            summary = "최초 취향 설문 점수 반영",
            description = """
                    전달된 주 스타일과 선택 색상의 중복을 제거하고 설정된 survey 가중치를
                    upsert한다. primaryStyle·color 취향 행이 하나도 없는 회원에게 한 번만 허용되며,
                    전체 항목 반영은 하나의 트랜잭션이다. 이후 행동 점수는 좋아요, 북마크,
                    컬렉션, 관심 없음, 체류시간 API에서 누적된다.
                    """
    )
    public ApiResponse<PreferenceDtos.Preferences> survey(
            @Valid @RequestBody PreferenceDtos.SurveyRequest request
    ) {
        return ApiResponse.of(preferenceScoreService.survey(
                SecurityUtils.currentUserSeq(),
                request
        ));
    }
}
