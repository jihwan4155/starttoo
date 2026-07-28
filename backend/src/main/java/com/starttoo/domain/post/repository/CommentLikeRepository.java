package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.CommentLikeEntity;
import com.starttoo.domain.post.entity.CommentLikeId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentLikeRepository extends JpaRepository<CommentLikeEntity, CommentLikeId> {
}

