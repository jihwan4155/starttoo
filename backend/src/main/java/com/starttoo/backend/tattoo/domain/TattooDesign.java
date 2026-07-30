package com.starttoo.backend.tattoo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "tattoo_designs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class TattooDesign {

    @Id
    @Column(name = "tattoo_seq")
    private Long tattooSeq;

    @Column(name = "image_seq", nullable = false, unique = true)
    private Long imageSeq;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    public void replaceImage(Long imageSeq) {
        this.imageSeq = imageSeq;
        this.deleted = false;
        this.modDttm = OffsetDateTime.now();
    }
}
