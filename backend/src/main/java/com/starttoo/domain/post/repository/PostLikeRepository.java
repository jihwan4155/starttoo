package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.PostLikeEntity;
import com.starttoo.domain.post.entity.PostUserId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostLikeRepository extends JpaRepository<PostLikeEntity, PostUserId> {
}

