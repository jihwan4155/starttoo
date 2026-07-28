package com.starttoo.domain.image.repository;

import com.starttoo.domain.image.entity.ImageEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ImageRepository extends JpaRepository<ImageEntity, Long> {
    Optional<ImageEntity> findByObjectKey(String objectKey);

    Page<ImageEntity> findAllByUsedForTrainingFalse(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select image from ImageEntity image where image.imageId in :imageIds")
    List<ImageEntity> findAllByImageIdInForUpdate(@Param("imageIds") List<Long> imageIds);
}
