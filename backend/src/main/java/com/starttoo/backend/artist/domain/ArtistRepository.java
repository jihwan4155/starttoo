package com.starttoo.backend.artist.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ArtistRepository extends JpaRepository<Artist, Integer> {
    Optional<Artist> findByUserSeqAndDeletedFalse(Integer userSeq);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT artist
              FROM Artist artist
             WHERE artist.userSeq = :userSeq
               AND artist.deleted = false
            """)
    Optional<Artist> findActiveForUpdate(@Param("userSeq") Integer userSeq);
}
