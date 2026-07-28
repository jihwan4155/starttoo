package com.starttoo.domain.dm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "dm_room_participants")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class DmRoomParticipantEntity {

    @EmbeddedId
    private DmRoomParticipantId id;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "last_hidden_message_id")
    private Long lastHiddenMessageId;

    @Column(name = "last_left_at")
    private LocalDateTime lastLeftAt;

    public void leave(Long lastHiddenMessageId, LocalDateTime now) {
        this.active = false;
        this.lastHiddenMessageId = lastHiddenMessageId;
        this.lastLeftAt = now;
    }

    public void reactivate() {
        this.active = true;
    }
}
