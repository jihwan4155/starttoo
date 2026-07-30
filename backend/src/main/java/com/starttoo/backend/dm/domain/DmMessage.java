package com.starttoo.backend.dm.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
@Table(name = "dm_messages")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class DmMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "dm_message_seq")
    private Long dmMessageSeq;

    @Column(name = "dm_room_seq", nullable = false)
    private Long dmRoomSeq;

    @Column(name = "sender_seq", nullable = false)
    private Integer senderSeq;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", nullable = false, length = 20)
    private DmMessageType messageType;

    @Column(name = "text_content", length = 4000)
    private String textContent;

    @Column(name = "image_seq")
    private Long imageSeq;

    @Column(name = "read_dttm")
    private OffsetDateTime readDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "mod_usr_seq", nullable = false)
    private Integer modUsrSeq;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    public void markRead() {
        if (readDttm == null) {
            this.readDttm = OffsetDateTime.now();
        }
    }

    public void delete(Integer modifierSeq) {
        this.deleted = true;
        this.modUsrSeq = modifierSeq;
        this.modDttm = OffsetDateTime.now();
    }
}
