package com.starttoo.backend.simulation.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@Builder
@Entity
@Table(name = "ar_simulation_session_designs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ArSimulationSessionDesign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ar_session_design_seq")
    private Long arSessionDesignSeq;

    @Column(name = "ar_session_seq", nullable = false)
    private Long arSessionSeq;

    /** {@code tattoo_designs.tattoo_seq}. 프론트가 부르는 designSeq 와 같은 값이다. */
    @Column(name = "tattoo_seq", nullable = false)
    private Long tattooSeq;

    @Column(name = "sort_order", nullable = false)
    private short sortOrder;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;
}
