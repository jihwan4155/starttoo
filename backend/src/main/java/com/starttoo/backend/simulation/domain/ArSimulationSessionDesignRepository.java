package com.starttoo.backend.simulation.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ArSimulationSessionDesignRepository
        extends JpaRepository<ArSimulationSessionDesign, Long> {

    List<ArSimulationSessionDesign> findAllByArSessionSeqOrderBySortOrderAsc(Long arSessionSeq);
}
