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
@Table(name = "ar_simulation_composites")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ArSimulationComposite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ar_composite_seq")
    private Long arCompositeSeq;

    @Column(name = "ar_session_seq", nullable = false)
    private Long arSessionSeq;

    @Column(name = "image_seq", nullable = false, unique = true)
    private Long imageSeq;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;
}
