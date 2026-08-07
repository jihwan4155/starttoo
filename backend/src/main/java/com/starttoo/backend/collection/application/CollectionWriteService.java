package com.starttoo.backend.collection.application;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class CollectionWriteService {

    private final TattooCollectionRepository collectionRepository;
    private final PreferenceScoreService preferenceScoreService;

    /**
     * 보관함 도안 타투를 재참조해 배치만 저장한다.
     * 같은 타투를 여러 위치에 올릴 수 있다.
     */
    @Transactional
    public CreatedCollection create(
            Integer userSeq,
            CollectionDtos.CreateCollectionRequest request,
            Tattoo tattoo,
            Long displayImageSeq,
            String displayObjectKey,
            boolean applyPreference
    ) {
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
        if (applyPreference) {
            preferenceScoreService.applyCollection(userSeq, tattoo.getTattooSeq(), true);
        }
        return new CreatedCollection(collection, tattoo, displayImageSeq, displayObjectKey);
    }

    public record CreatedCollection(
            TattooCollection collection,
            Tattoo tattoo,
            Long displayImageSeq,
            String displayObjectKey
    ) {
    }
}
