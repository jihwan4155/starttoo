package com.starttoo.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Getter
@Embeddable
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class UserTattooPreferenceId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "tattoo_id", nullable = false)
    private Long tattooId;

    @Column(name = "preference_source", nullable = false, length = 20)
    private String preferenceSource;
}

