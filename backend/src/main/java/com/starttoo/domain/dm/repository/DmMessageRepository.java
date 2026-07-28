package com.starttoo.domain.dm.repository;

import com.starttoo.domain.dm.entity.DmMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface DmMessageRepository extends JpaRepository<DmMessageEntity, Long> {
    Optional<DmMessageEntity> findTopByDmRoomIdOrderByDmMessageIdDesc(Long dmRoomId);
    List<DmMessageEntity> findAllByDmRoomIdAndDmMessageIdGreaterThanAndDmMessageIdLessThanOrderByDmMessageIdDesc(
            Long dmRoomId, Long hiddenId, Long cursor, Pageable pageable);
    List<DmMessageEntity> findAllByDmRoomIdAndSenderIdNotAndReadAtIsNullAndDmMessageIdLessThanEqual(
            Long dmRoomId, Long senderId, Long messageId);
    long countByDmRoomIdAndSenderIdNotAndReadAtIsNullAndDmMessageIdGreaterThan(Long dmRoomId, Long senderId, Long hiddenId);
}
