package com.starttoo.backend.dm.domain;

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

    @Column(name = "dm_room_seq")
    private Long dmRoomSeq;

    @Column(name = "user_seq")
    private Integer userSeq;
}
