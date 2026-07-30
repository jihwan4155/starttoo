package com.starttoo.backend.collection.application;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CollectionService {

    private final TattooCollectionRepository collectionRepository;
    private final TattooRepository tattooRepository;
    private final TattooService tattooService;
    private final PreferenceScoreService preferenceScoreService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public CollectionDtos.CollectionResponse create(
            Integer userSeq,
            CollectionDtos.CreateCollectionRequest request
    ) {
        Tattoo tattoo = tattooService.process(
                userSeq,
                request.imageSeq(),
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
        return response(collection, tattoo.getImageSeq());
    }

    @Transactional(readOnly = true)
    public List<CollectionDtos.CollectionResponse> list(Integer userSeq) {
        List<TattooCollection> collections = collectionRepository
                .findAllByUserSeqAndDeletedFalseOrderByCollectionSeqDesc(userSeq);
        Map<Long, Tattoo> tattoos = new HashMap<>();
        tattooRepository.findAllById(
                collections.stream().map(TattooCollection::getTattooSeq).toList()
        ).stream()
                .filter(value -> !value.isDeleted())
                .forEach(value -> tattoos.put(value.getTattooSeq(), value));
        return collections.stream().map(collection -> {
            Tattoo tattoo = tattoos.get(collection.getTattooSeq());
            if (tattoo == null) {
                throw BusinessException.of(ErrorCode.TATTOO_NOT_FOUND);
            }
            return response(collection, tattoo.getImageSeq());
        }).toList();
    }

    @Transactional
    public CollectionDtos.CollectionResponse update(
            Integer userSeq,
            Long collectionSeq,
            CollectionDtos.UpdatePlacementRequest request
    ) {
        TattooCollection collection = findOwned(userSeq, collectionSeq);
        collection.updatePlacement(
                request.bodyView(),
                request.positionX(),
                request.positionY(),
                request.scaleRatio(),
                request.rotationDegree(),
                request.flipped()
        );
        Tattoo tattoo = tattooRepository.findByTattooSeqAndDeletedFalse(collection.getTattooSeq())
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        return response(collection, tattoo.getImageSeq());
    }

    @Transactional
    public void delete(Integer userSeq, Long collectionSeq) {
        TattooCollection collection = findOwned(userSeq, collectionSeq);
        preferenceScoreService.applyCollection(userSeq, collection.getTattooSeq(), false);
        collection.softDelete();
        tattooRepository.findByTattooSeqAndDeletedFalse(collection.getTattooSeq())
                .ifPresent(Tattoo::softDelete);
    }

    @Transactional
    public boolean setArchive(Integer userSeq, Long tattooSeq, boolean enabled) {
        if (enabled) {
            int inserted = jdbcTemplate.update("""
                    INSERT INTO user_archive (user_seq, tattoo_seq)
                    SELECT ?, td.tattoo_seq
                      FROM tattoo_designs td
                     WHERE td.tattoo_seq = ? AND td.is_deleted = FALSE
                    ON CONFLICT DO NOTHING
                    """, userSeq, tattooSeq);
            if (inserted == 0 && !archiveExists(userSeq, tattooSeq)) {
                throw new BusinessException(
                        ErrorCode.STATE_CONFLICT,
                        "보관함에는 tattoo_designs에 등록된 타투만 저장할 수 있습니다."
                );
            }
            if (inserted > 0) {
                preferenceScoreService.applyCollection(userSeq, tattooSeq, true);
            }
            return true;
        }
        int deleted = jdbcTemplate.update(
                "DELETE FROM user_archive WHERE user_seq = ? AND tattoo_seq = ?",
                userSeq,
                tattooSeq
        );
        if (deleted > 0) {
            preferenceScoreService.applyCollection(userSeq, tattooSeq, false);
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<Long> archive(Integer userSeq) {
        return jdbcTemplate.queryForList(
                "SELECT tattoo_seq FROM user_archive WHERE user_seq = ? ORDER BY reg_dttm DESC",
                Long.class,
                userSeq
        );
    }

    private TattooCollection findOwned(Integer userSeq, Long collectionSeq) {
        return collectionRepository.findByCollectionSeqAndUserSeqAndDeletedFalse(
                collectionSeq,
                userSeq
        ).orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
    }

    private boolean archiveExists(Integer userSeq, Long tattooSeq) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM user_archive WHERE user_seq = ? AND tattoo_seq = ?
                )
                """, Boolean.class, userSeq, tattooSeq));
    }

    private CollectionDtos.CollectionResponse response(
            TattooCollection collection,
            Long imageSeq
    ) {
        return new CollectionDtos.CollectionResponse(
                collection.getCollectionSeq(),
                collection.getTattooSeq(),
                imageSeq,
                collection.getBodyView(),
                collection.getPositionX(),
                collection.getPositionY(),
                collection.getScaleRatio(),
                collection.getRotationDegree(),
                collection.isFlipped(),
                collection.getRegDttm(),
                collection.getModDttm()
        );
    }
}
