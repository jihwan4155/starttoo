package com.starttoo.backend.tattoo.api;

import com.starttoo.backend.tattoo.domain.TattooSourceType;

import java.time.OffsetDateTime;
import java.util.List;

public final class TattooDtos {

    private TattooDtos() {
    }

    public record TattooResponse(
            Long tattooSeq,
            Integer registrantSeq,
            Long imageSeq,
            TattooSourceType sourceType,
            Integer primaryStyleSeq,
            List<Integer> secondaryStyleSeqs,
            List<Integer> renderingStyleSeqs,
            Integer colorSeq,
            List<SubjectResponse> subjects,
            boolean usedForTraining,
            OffsetDateTime trainedDttm,
            OffsetDateTime regDttm
    ) {
    }

    public record SubjectResponse(Integer subjectSeq, String subjectName) {
    }

    public record ClassificationItem(Integer seq, String code, String name) {
    }
}
