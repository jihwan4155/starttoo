package com.starttoo.domain.tattoo.repository;

import com.starttoo.domain.tattoo.entity.TattooCollectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface TattooCollectionRepository extends JpaRepository<TattooCollectionEntity, Long> {
    List<TattooCollectionEntity> findAllByUserIdAndCollectionIdLessThanOrderByCollectionIdDesc(Long userId, Long cursor, Pageable pageable);
    Optional<TattooCollectionEntity> findByCollectionIdAndUserId(Long collectionId, Long userId);
}
