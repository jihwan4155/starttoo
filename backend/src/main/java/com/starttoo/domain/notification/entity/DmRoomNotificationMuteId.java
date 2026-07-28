package com.starttoo.domain.notification.entity;

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
public class DmRoomNotificationMuteId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "dm_room_id", nullable = false)
    private Long dmRoomId;
}
