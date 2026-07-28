package com.starttoo.domain.search.repository;

import com.starttoo.domain.search.entity.UserRecentSearchEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface UserRecentSearchRepository extends JpaRepository<UserRecentSearchEntity, Long> {
    List<UserRecentSearchEntity> findAllByUserIdOrderBySearchedAtDesc(Long userId, Pageable pageable);
    Optional<UserRecentSearchEntity> findByUserIdAndKeyword(Long userId, String keyword);
    Optional<UserRecentSearchEntity> findByRecentSearchIdAndUserId(Long recentSearchId, Long userId);
    void deleteAllByUserId(Long userId);
}
