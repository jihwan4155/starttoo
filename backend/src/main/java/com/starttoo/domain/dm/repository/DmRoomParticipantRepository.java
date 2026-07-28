package com.starttoo.domain.dm.repository;

import com.starttoo.domain.dm.entity.DmRoomParticipantEntity;
import com.starttoo.domain.dm.entity.DmRoomParticipantId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DmRoomParticipantRepository extends JpaRepository<DmRoomParticipantEntity, DmRoomParticipantId> {
    List<DmRoomParticipantEntity> findAllByIdUserIdAndActiveTrue(Long userId, Pageable pageable);
    List<DmRoomParticipantEntity> findAllByIdUserIdAndActiveTrueAndIdDmRoomIdLessThanOrderByIdDmRoomIdDesc(Long userId, Long cursor, Pageable pageable);

    @Query("""
            select p from DmRoomParticipantEntity p join DmRoomEntity r on r.dmRoomId=p.id.dmRoomId
            where p.id.userId=:userId and p.active=true
            order by r.lastMessageAt desc, r.dmRoomId desc
            """)
    Slice<DmRoomParticipantEntity> findActiveRooms(@Param("userId") Long userId, Pageable pageable);
}
