package com.starttoo.backend.preference.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public final class PreferenceDtos {

    private PreferenceDtos() {
    }

    public record SurveyRequest(
            @Schema(description = "선택한 주 스타일 seq 목록. 서버에서 중복 제거",
                    example = "[1, 3, 5]")
            @NotEmpty @Size(max = 50) List<@NotNull Integer> primaryStyleSeqs,
            @Schema(description = "선택한 색상 seq 목록. 선택하지 않으면 null 또는 빈 배열",
                    example = "[1, 2]")
            @Size(max = 50) List<@NotNull Integer> colorSeqs
    ) {
    }

    public record Score(Integer classificationSeq, BigDecimal score) {
    }

    public record Preferences(List<Score> primaryStyles, List<Score> colors) {
    }
}
