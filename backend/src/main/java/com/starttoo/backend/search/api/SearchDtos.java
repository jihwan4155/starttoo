package com.starttoo.backend.search.api;

import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.user.domain.UserRole;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public final class SearchDtos {

    private SearchDtos() {
    }

    public record AccountResult(Integer userSeq, String nickname, UserRole role) {
    }

    public record SubjectResult(
            Integer subjectSeq,
            String subjectName
    ) {
    }

    public record PostSearchResponse(
            String query,
            SubjectResult matchedSubject,
            @Schema(
                    description = "Redis 검색 단계",
                    allowableValues = {"EXACT", "PREFIX", "FUZZY_1", "FUZZY_2", "CONTAINS"}
            )
            String matchType,
            List<PostDtos.PostResponse> items,
            String nextCursor,
            boolean hasNext,
            int size
    ) {
    }
}
