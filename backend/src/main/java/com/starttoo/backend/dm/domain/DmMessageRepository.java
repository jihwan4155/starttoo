package com.starttoo.backend.dm.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface DmMessageRepository extends JpaRepository<DmMessage, Long> {
    Optional<DmMessage> findTopByDmRoomSeqOrderByDmMessageSeqDesc(Long dmRoomSeq);

    Optional<DmMessage> findByDmMessageSeqAndDmRoomSeq(Long messageSeq, Long roomSeq);

    @Modifying
    @Query("""
            update DmMessage m
               set m.readDttm = :readDttm
             where m.dmRoomSeq = :roomSeq
               and m.senderSeq <> :readerSeq
               and m.readDttm is null
               and m.deleted = false
            """)
    int markRoomRead(
            @Param("roomSeq") Long roomSeq,
            @Param("readerSeq") Integer readerSeq,
            @Param("readDttm") OffsetDateTime readDttm
    );
}
