package com.starttoo.backend.collection;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.application.CollectionWriteService;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CollectionWriteServiceTest {

    @Mock
    private TattooCollectionRepository collectionRepository;

    @Mock
    private TattooService tattooService;

    @Mock
    private PreferenceScoreService preferenceScoreService;

    @InjectMocks
    private CollectionWriteService collectionWriteService;

    @Test
    void collectionSaveFailureDoesNotApplyPreferenceScore() {
        CollectionDtos.CreateCollectionRequest request =
                new CollectionDtos.CreateCollectionRequest(
                        301L, "front", 0.42, 0.35, 0.8, -15.0, false
                );
        TattooService.PreparedTattoo prepared = new TattooService.PreparedTattoo(
                301L,
                "users/7/collection/original.png",
                new TattooModelClient.Analysis(
                        "OTHER",
                        List.of(),
                        List.of("LINE"),
                        "BLACK",
                        List.of("SAMPLE")
                )
        );
        when(tattooService.persistPrepared(
                7,
                prepared,
                TattooSourceType.USER_COLLECTION
        )).thenReturn(tattoo());
        when(collectionRepository.save(any(TattooCollection.class)))
                .thenThrow(new RuntimeException("collection insert failed"));

        assertThatThrownBy(() -> collectionWriteService.create(7, request, prepared))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("collection insert failed");

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
        verify(tattooService).persistPrepared(
                eq(7),
                eq(prepared),
                eq(TattooSourceType.USER_COLLECTION)
        );
    }

    private Tattoo tattoo() {
        OffsetDateTime now = OffsetDateTime.now();
        return Tattoo.builder()
                .tattooSeq(501L)
                .registrantSeq(7)
                .imageSeq(301L)
                .sourceType(TattooSourceType.USER_COLLECTION)
                .primaryStyleSeq(1)
                .usedForTraining(false)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
    }
}
