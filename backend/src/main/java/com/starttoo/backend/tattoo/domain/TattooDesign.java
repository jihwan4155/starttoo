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

    /** 커버업 검색 엔진에 색인이 반영됐는지 여부. 실제 반영은 색인 동기화 스캔이 담당한다. */
    @Column(name = "indexed", nullable = false)
    private boolean indexed;

    public void replaceImage(Long imageSeq) {
        this.imageSeq = imageSeq;
        this.deleted = false;
        // 변경: 이미지가 바뀌면 기존 색인은 다른 그림을 가리킨다. 재색인 대상으로 되돌린다.
        this.indexed = false;
        this.modDttm = OffsetDateTime.now();
    }
}
