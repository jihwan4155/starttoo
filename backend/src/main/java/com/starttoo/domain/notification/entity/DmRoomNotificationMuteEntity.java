package com.starttoo.domain.notification.entity;

import com.starttoo.common.persistence.CreatedAtEntity;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "dm_room_notification_mutes")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class DmRoomNotificationMuteEntity extends CreatedAtEntity {

    @EmbeddedId
    private DmRoomNotificationMuteId id;
}
