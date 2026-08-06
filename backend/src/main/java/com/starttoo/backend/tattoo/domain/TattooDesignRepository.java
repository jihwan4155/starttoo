package com.starttoo.backend.tattoo.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TattooDesignRepository extends JpaRepository<TattooDesign, Long> {
    Optional<TattooDesign> findByTattooSeqAndDeletedFalse(Long tattooSeq);

    List<TattooDesign> findAllByTattooSeqInAndDeletedFalse(Collection<Long> tattooSeqs);
}
