package com.starttoo.backend.tattoo.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TattooRepository extends JpaRepository<Tattoo, Long> {
    Optional<Tattoo> findByTattooSeqAndDeletedFalse(Long tattooSeq);

    Optional<Tattoo> findByImageSeqAndDeletedFalse(Long imageSeq);
}
