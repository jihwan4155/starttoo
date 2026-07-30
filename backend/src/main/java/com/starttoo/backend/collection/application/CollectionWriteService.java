package com.starttoo.backend.collection.application;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class CollectionWriteService {

    private final TattooCollectionRepository collectionRepository;
    private final TattooService tattooService;
    private final PreferenceScoreService preferenceScoreService;

    @Transactional
    public CreatedCollection create(
            Integer userSeq,
            CollectionDtos.CreateCollectionRequest request,
            TattooService.PreparedTattoo prepared
    ) {
        Tattoo tattoo = tattooService.persistPrepared(
                userSeq,
                prepared,
                TattooSourceType.USER_COLLECTION
        );
        OffsetDateTime now = OffsetDateTime.now();
        TattooCollection collection = collectionRepository.save(TattooCollection.builder()
                .userSeq(userSeq)
                .tattooSeq(tattoo.getTattooSeq())
                .bodyView(request.bodyView())
                .positionX(request.positionX())
                .positionY(request.positionY())
                .scaleRatio(request.scaleRatio())
                .rotationDegree(request.rotationDegree())
                .flipped(request.flipped())
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build());
        preferenceScoreService.applyCollection(userSeq, tattoo.getTattooSeq(), true);
        return new CreatedCollection(collection, tattoo);
    }

    public record CreatedCollection(TattooCollection collection, Tattoo tattoo) {
    }
}
