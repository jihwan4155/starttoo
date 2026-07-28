package com.starttoo.domain.social.repository;

import com.starttoo.domain.social.entity.UserBlockEntity;
import com.starttoo.domain.social.entity.UserBlockId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserBlockRepository extends JpaRepository<UserBlockEntity, UserBlockId> {
    @Query("select count(b) > 0 from UserBlockEntity b where (b.id.blockerId=:a and b.id.blockedId=:b) or (b.id.blockerId=:b and b.id.blockedId=:a)")
    boolean existsEitherDirection(@Param("a") Long a, @Param("b") Long b);

    List<UserBlockEntity> findAllByIdBlockerIdAndIdBlockedIdLessThanOrderByIdBlockedIdDesc(Long blockerId, Long cursor, Pageable pageable);
}
