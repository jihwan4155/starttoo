package com.starttoo.domain.social.repository;

import com.starttoo.domain.social.entity.UserFollowEntity;
import com.starttoo.domain.social.entity.UserFollowId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface UserFollowRepository extends JpaRepository<UserFollowEntity, UserFollowId> {
    long countByIdFollowingId(Long followingId);
    long countByIdFollowerId(Long followerId);
    List<UserFollowEntity> findAllByIdFollowingIdAndIdFollowerIdLessThanOrderByIdFollowerIdDesc(Long followingId, Long cursor, Pageable pageable);
    List<UserFollowEntity> findAllByIdFollowerIdAndIdFollowingIdLessThanOrderByIdFollowingIdDesc(Long followerId, Long cursor, Pageable pageable);
    void deleteByIdFollowerIdAndIdFollowingId(Long followerId, Long followingId);
}
