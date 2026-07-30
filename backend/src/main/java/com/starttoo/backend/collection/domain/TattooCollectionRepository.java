package com.starttoo.backend.collection.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TattooCollectionRepository extends JpaRepository<TattooCollection, Long> {
    Optional<TattooCollection> findByCollectionSeqAndUserSeqAndDeletedFalse(
            Long collectionSeq,
            Integer userSeq
    );

    List<TattooCollection> findAllByUserSeqAndDeletedFalseOrderByCollectionSeqDesc(Integer userSeq);
}
