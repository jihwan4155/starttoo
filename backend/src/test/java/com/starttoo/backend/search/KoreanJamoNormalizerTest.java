package com.starttoo.backend.search;

import com.starttoo.backend.search.application.KoreanJamoNormalizer;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class KoreanJamoNormalizerTest {

    private final KoreanJamoNormalizer normalizer = new KoreanJamoNormalizer();

    @Test
    void decomposesHangulAndLowercasesLatin() {
        assertThat(normalizer.normalize("검은Rose21"))
                .isEqualTo("ㄱㅓㅁㅇㅡㄴrose21");
    }

    @Test
    void supportsPartialJamoPrefix() {
        String indexed = normalizer.normalize("검은장미타투");
        assertThat(indexed).startsWith(normalizer.normalize("검ㅇ"));
    }

    @Test
    void foldsLatinCaseSoQueriesMatchRegardlessOfCase() {
        assertThat(normalizer.normalize("TattooFan01"))
                .isEqualTo("tattoofan01")
                .isEqualTo(normalizer.normalize("tattoofan01"));
    }
}
