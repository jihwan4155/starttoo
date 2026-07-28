package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.PostBookmarkEntity;
import com.starttoo.domain.post.entity.PostUserId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;

import java.util.List;

public interface PostBookmarkRepository extends JpaRepository<PostBookmarkEntity, PostUserId> {
    Slice<PostBookmarkEntity> findAllByIdUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
