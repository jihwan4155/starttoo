package com.starttoo.backend.tattoo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "tattoos")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Tattoo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tattoo_seq")
    private Long tattooSeq;

    @Column(name = "registrant_seq", nullable = false)
    private Integer registrantSeq;

    @Column(name = "image_seq", nullable = false, unique = true)
    private Long imageSeq;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private TattooSourceType sourceType;

    @Column(name = "primary_style_seq", nullable = false)
    private Integer primaryStyleSeq;

    @Column(name = "secondary_style_1_seq")
    private Integer secondaryStyle1Seq;

    @Column(name = "secondary_style_2_seq")
    private Integer secondaryStyle2Seq;

    @Column(name = "rendering_style_1_seq")
    private Integer renderingStyle1Seq;

    @Column(name = "rendering_style_2_seq")
    private Integer renderingStyle2Seq;

    @Column(name = "color_seq")
    private Integer colorSeq;

    @Column(name = "is_used_for_training", nullable = false)
    private boolean usedForTraining;

    @Column(name = "trained_dttm")
    private OffsetDateTime trainedDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    public void markUsedForTraining() {
        this.usedForTraining = true;
        this.trainedDttm = OffsetDateTime.now();
        this.modDttm = OffsetDateTime.now();
    }

    public void softDelete() {
        this.deleted = true;
        this.modDttm = OffsetDateTime.now();
    }
}
