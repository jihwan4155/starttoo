package com.starttoo.backend.user.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByUserSeqAndDeletedFalse(Integer userSeq);

    Optional<User> findByPhoneNumberAndAccountStatusNotAndDeletedFalse(
            String phoneNumber,
            AccountStatus excludedStatus
    );

    boolean existsByNicknameAndAccountStatusNotAndDeletedFalse(
            String nickname,
            AccountStatus excludedStatus
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT user
              FROM User user
             WHERE user.userSeq = :userSeq
               AND user.deleted = false
            """)
    Optional<User> findActiveForUpdate(@Param("userSeq") Integer userSeq);
}
