package com.starttoo.backend.collection;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.application.CollectionWriteService;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CollectionWriteServiceTest {

    @Mock
    private TattooCollectionRepository collectionRepository;

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
        when(collectionRepository.save(any(TattooCollection.class)))
                .thenThrow(new RuntimeException("collection insert failed"));

        assertThatThrownBy(() -> collectionWriteService.create(
                7,
                request,
                tattoo(),
                301L,
                "users/7/design.png",
                true
        ))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("collection insert failed");

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    @Test
    void reusePlacementSkipsPreferenceWhenRequested() {
        CollectionDtos.CreateCollectionRequest request =
                new CollectionDtos.CreateCollectionRequest(
                        301L, "front", 0.42, 0.35, 0.8, -15.0, false
                );
        when(collectionRepository.save(any(TattooCollection.class)))
                .thenAnswer(invocation -> {
                    TattooCollection saved = invocation.getArgument(0);
                    return TattooCollection.builder()
                            .collectionSeq(601L)
                            .userSeq(saved.getUserSeq())
                            .tattooSeq(saved.getTattooSeq())
                            .bodyView(saved.getBodyView())
                            .positionX(saved.getPositionX())
                            .positionY(saved.getPositionY())
                            .scaleRatio(saved.getScaleRatio())
                            .rotationDegree(saved.getRotationDegree())
                            .flipped(saved.isFlipped())
                            .regDttm(saved.getRegDttm())
                            .modDttm(saved.getModDttm())
                            .deleted(saved.isDeleted())
                            .build();
                });

        collectionWriteService.create(
                7,
                request,
                tattoo(),
                301L,
                "users/7/design.png",
                false
        );

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    private Tattoo tattoo() {
        OffsetDateTime now = OffsetDateTime.now();
        return Tattoo.builder()
                .tattooSeq(501L)
                .registrantSeq(7)
                .imageSeq(201L)
                .sourceType(TattooSourceType.USER_POST)
                .primaryStyleSeq(1)
                .usedForTraining(false)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
    }
}
