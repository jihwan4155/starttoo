package com.starttoo.domain.dm.repository;

import com.starttoo.domain.dm.entity.DmRoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface DmRoomRepository extends JpaRepository<DmRoomEntity, Long> {
    @Query("select r from DmRoomEntity r where (r.user1Id=:a and r.user2Id=:b) or (r.user1Id=:b and r.user2Id=:a)")
    Optional<DmRoomEntity> findBetween(@Param("a") Long a, @Param("b") Long b);
}
