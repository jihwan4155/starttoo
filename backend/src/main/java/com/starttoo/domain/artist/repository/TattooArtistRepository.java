package com.starttoo.domain.artist.repository;

import com.starttoo.domain.artist.entity.TattooArtistEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface TattooArtistRepository extends JpaRepository<TattooArtistEntity, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select artist from TattooArtistEntity artist where artist.userId = :userId")
    Optional<TattooArtistEntity> findByUserIdForUpdate(@Param("userId") Long userId);

    @Query("""
            select a from TattooArtistEntity a join UserEntity u on u.userId = a.userId
            where u.role = 'ARTIST' and u.accountStatus = 'ACTIVE'
              and (:shopCity is null or a.shopCity = :shopCity)
              and (:cursorPopularity is null or a.popularity < :cursorPopularity
                   or (a.popularity = :cursorPopularity and a.userId < :cursorUserId))
            order by a.popularity desc, a.userId desc
            """)
    List<TattooArtistEntity> searchPopular(
            @Param("shopCity") String shopCity,
            @Param("cursorPopularity") BigDecimal cursorPopularity,
            @Param("cursorUserId") Long cursorUserId,
            Pageable pageable
    );

    @Query("""
            select a from TattooArtistEntity a join UserEntity u on u.userId = a.userId
            where u.role = 'ARTIST' and u.accountStatus = 'ACTIVE'
              and (:shopCity is null or a.shopCity = :shopCity)
              and u.nickname like concat('%', :nickname, '%')
            order by case
                when u.nickname = :nickname then 3
                when u.nickname like concat(:nickname, '%') then 2
                else 1 end desc,
                a.popularity desc, a.userId desc
            """)
    Slice<TattooArtistEntity> searchByNickname(
            @Param("shopCity") String shopCity,
            @Param("nickname") String nickname,
            Pageable pageable
    );
}
