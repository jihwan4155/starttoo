package com.starttoo.domain.dm.entity;

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
public class DmRoomParticipantId implements Serializable {

    @Column(name = "dm_room_id", nullable = false)
    private Long dmRoomId;

    @Column(name = "user_id", nullable = false)
    private Long userId;
}
