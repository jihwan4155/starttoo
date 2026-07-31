package com.starttoo.backend.preference.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.preference.application.PreferenceScoreService;
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
@RequestMapping("/v1/preferences")
@RequiredArgsConstructor
@Tag(name = "Preferences", description = "회원가입 최초 취향 설문")
@SecurityRequirement(name = "bearerAuth")
public class PreferenceController {

    private final PreferenceScoreService preferenceScoreService;

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
