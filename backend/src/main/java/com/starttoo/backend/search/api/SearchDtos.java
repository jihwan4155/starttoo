package com.starttoo.backend.search.api;

import com.starttoo.backend.user.domain.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public final class SearchDtos {

    private SearchDtos() {
    }

    public record AccountResult(Integer userSeq, String nickname, UserRole role) {
    }

    public record SubjectCorrection(
            Integer subjectSeq,
            String subjectName,
            @Schema(
                    description = "Redis 검색 단계",
                    allowableValues = {"EXACT", "PREFIX", "FUZZY_1", "FUZZY_2", "CONTAINS"}
            )
            String matchType,
            @Schema(description = "fuzzy 단계의 편집거리. contains는 -1", example = "1")
            int editDistance,
            @Schema(description = "같은 matchType 내부에서 사용하는 Redis 점수", example = "1.0")
            double redisScore
    ) {
    }

    public record PostSearchResult(
            Long postSeq,
            List<String> matchedSubjects,
            @Schema(
                    description = "게시물을 노출시킨 최상위 subject의 Redis 검색 단계",
                    allowableValues = {"EXACT", "PREFIX", "FUZZY_1", "FUZZY_2", "CONTAINS"}
            )
            String matchType,
            @Schema(description = "같은 matchType 내부에서 사용하는 Redis 점수", example = "1.0")
            double redisScore
    ) {
    }
}
