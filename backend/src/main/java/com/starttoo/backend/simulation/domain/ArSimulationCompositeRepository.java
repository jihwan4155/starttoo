package com.starttoo.backend.simulation.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ArSimulationCompositeRepository
        extends JpaRepository<ArSimulationComposite, Long> {

    List<ArSimulationComposite> findAllByArSessionSeqOrderByArCompositeSeqAsc(Long arSessionSeq);
}
