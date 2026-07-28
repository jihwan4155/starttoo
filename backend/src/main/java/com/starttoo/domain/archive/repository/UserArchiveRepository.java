package com.starttoo.domain.archive.repository;

import com.starttoo.domain.archive.entity.UserArchiveEntity;
import com.starttoo.domain.archive.entity.UserArchiveId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;

import java.util.List;

public interface UserArchiveRepository extends JpaRepository<UserArchiveEntity, UserArchiveId> {
    Slice<UserArchiveEntity> findAllByIdUserIdOrderBySavedAtDesc(Long userId, Pageable pageable);
}
