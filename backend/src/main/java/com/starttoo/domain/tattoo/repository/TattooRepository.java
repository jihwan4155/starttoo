package com.starttoo.domain.tattoo.repository;

import com.starttoo.domain.tattoo.entity.TattooEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TattooRepository extends JpaRepository<TattooEntity, Long> {
    boolean existsByImageId(Long imageId);
}
