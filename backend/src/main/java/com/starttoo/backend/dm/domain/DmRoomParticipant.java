package com.starttoo.backend.dm.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
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
@Table(name = "dm_room_participants")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class DmRoomParticipant {

    @EmbeddedId
    private DmRoomParticipantId id;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "is_notification_enabled", nullable = false)
    private boolean notificationEnabled;

    @Column(name = "last_hidden_message_seq")
    private Long lastHiddenMessageSeq;

    @Column(name = "last_left_dttm")
    private OffsetDateTime lastLeftDttm;

    public void leave(Long lastMessageSeq) {
        this.active = false;
        this.lastHiddenMessageSeq = lastMessageSeq;
        this.lastLeftDttm = OffsetDateTime.now();
    }

    public void reactivate() {
        this.active = true;
    }

    public void changeNotification(boolean enabled) {
        this.notificationEnabled = enabled;
    }
}
