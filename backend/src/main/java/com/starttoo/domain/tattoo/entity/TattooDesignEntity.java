package com.starttoo.domain.tattoo.entity;

import com.starttoo.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "tattoo_designs")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class TattooDesignEntity extends BaseTimeEntity {

    @Id
    @Column(name = "tattoo_id")
    private Long tattooId;

    @Column(name = "image_id", nullable = false)
    private Long imageId;

    public void replaceImage(Long imageId) {
        this.imageId = imageId;
    }
}
