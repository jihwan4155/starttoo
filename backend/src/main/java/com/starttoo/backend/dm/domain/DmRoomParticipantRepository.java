package com.starttoo.backend.dm.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DmRoomParticipantRepository
        extends JpaRepository<DmRoomParticipant, DmRoomParticipantId> {

    Optional<DmRoomParticipant> findByIdDmRoomSeqAndIdUserSeq(
            Long dmRoomSeq,
            Integer userSeq
    );
}
