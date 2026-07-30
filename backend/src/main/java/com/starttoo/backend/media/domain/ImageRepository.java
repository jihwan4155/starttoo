package com.starttoo.backend.media.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ImageRepository extends JpaRepository<Image, Long> {
    Optional<Image> findByImageSeqAndDeletedFalse(Long imageSeq);

    Optional<Image> findByObjectKeyAndDeletedFalse(String objectKey);
}
