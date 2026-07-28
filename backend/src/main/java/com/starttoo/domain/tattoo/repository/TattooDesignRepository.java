package com.starttoo.domain.tattoo.repository;

import com.starttoo.domain.tattoo.entity.TattooDesignEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TattooDesignRepository extends JpaRepository<TattooDesignEntity, Long> {
}

