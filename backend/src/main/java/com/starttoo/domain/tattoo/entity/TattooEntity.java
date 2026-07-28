package com.starttoo.domain.tattoo.entity;

import com.starttoo.common.persistence.BaseTimeEntity;
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

@Getter
@Entity
@Table(name = "tattoos")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class TattooEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tattoo_id")
    private Long tattooId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "image_id", nullable = false)
    private Long imageId;

    @Column(name = "source_type", nullable = false, length = 30)
    private String sourceType;

    @Column(name = "primary_style", length = 100)
    private String primaryStyle;

    @Column(name = "secondary_style", length = 100)
    private String secondaryStyle;

    @Column(name = "color", length = 100)
    private String color;

    @Column(name = "rendering", length = 20)
    private String rendering;
}
