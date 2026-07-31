package com.starttoo.backend.search;

import com.starttoo.backend.search.application.KoreanJamoNormalizer;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class KoreanJamoNormalizerTest {

    private final KoreanJamoNormalizer normalizer = new KoreanJamoNormalizer();

    @Test
    void decomposesHangulAndPreservesLatinAndNumbers() {
        assertThat(normalizer.normalize("검은Rose21"))
                .isEqualTo("ㄱㅓㅁㅇㅡㄴRose21");
    }

    @Test
    void supportsPartialJamoPrefix() {
        String indexed = normalizer.normalize("검은장미타투");
        assertThat(indexed).startsWith(normalizer.normalize("검ㅇ"));
    }

    @Test
    void preservesLatinCaseDistinction() {
        assertThat(normalizer.normalize("Rose21"))
                .isEqualTo("Rose21")
                .isNotEqualTo(normalizer.normalize("rose21"));
    }
}
