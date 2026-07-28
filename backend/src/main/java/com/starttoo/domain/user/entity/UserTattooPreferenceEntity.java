package com.starttoo.domain.user.entity;

import com.starttoo.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Entity
@Table(name = "user_tattoo_preferences")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class UserTattooPreferenceEntity extends BaseTimeEntity {

    @EmbeddedId
    private UserTattooPreferenceId id;

    @Builder.Default
    @Column(name = "score", nullable = false, precision = 8, scale = 4)
    private BigDecimal score = new BigDecimal("1.0000");
}

