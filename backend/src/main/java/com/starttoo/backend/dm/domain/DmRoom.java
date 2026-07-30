package com.starttoo.backend.dm.domain;

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

import java.time.OffsetDateTime;

@Getter
@Builder
@Entity
@Table(name = "dm_rooms")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class DmRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "dm_room_seq")
    private Long dmRoomSeq;

    @Column(name = "user1_seq", nullable = false)
    private Integer user1Seq;

    @Column(name = "user2_seq", nullable = false)
    private Integer user2Seq;

    @Column(name = "last_message_dttm")
    private OffsetDateTime lastMessageDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    public void touchLastMessage() {
        this.lastMessageDttm = OffsetDateTime.now();
    }

    public boolean contains(Integer userSeq) {
        return user1Seq.equals(userSeq) || user2Seq.equals(userSeq);
    }

    public Integer partnerOf(Integer userSeq) {
        return user1Seq.equals(userSeq) ? user2Seq : user1Seq;
    }
}
