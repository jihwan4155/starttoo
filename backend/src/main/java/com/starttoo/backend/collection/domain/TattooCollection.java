package com.starttoo.backend.collection.domain;

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
@Table(name = "tattoo_collections")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class TattooCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "collection_seq")
    private Long collectionSeq;

    @Column(name = "user_seq", nullable = false)
    private Integer userSeq;

    @Column(name = "tattoo_seq", nullable = false)
    private Long tattooSeq;

    @Column(name = "body_view", nullable = false, length = 10)
    private String bodyView;

    @Column(name = "position_x", nullable = false)
    private double positionX;

    @Column(name = "position_y", nullable = false)
    private double positionY;

    @Column(name = "scale_ratio", nullable = false)
    private double scaleRatio;

    @Column(name = "rotation_degree", nullable = false)
    private double rotationDegree;

    @Column(name = "is_flipped", nullable = false)
    private boolean flipped;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    public void softDelete() {
        this.deleted = true;
        this.modDttm = OffsetDateTime.now();
    }
}
