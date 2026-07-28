package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.CommentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;

import java.util.List;

public interface CommentRepository extends JpaRepository<CommentEntity, Long> {
    List<CommentEntity> findAllByPostIdAndParentCommentIdIsNullAndCommentIdLessThanOrderByCommentIdDesc(Long postId, Long cursor, Pageable pageable);
    List<CommentEntity> findAllByPostIdAndParentCommentIdIsNullAndCommentIdLessThan(Long postId, Long cursor, Pageable pageable);
    Slice<CommentEntity> findAllByPostIdAndParentCommentIdIsNull(Long postId, Pageable pageable);
    List<CommentEntity> findAllByParentCommentIdAndCommentIdGreaterThanOrderByCommentIdAsc(Long parentCommentId, Long cursor, Pageable pageable);
    List<CommentEntity> findAllByParentCommentIdAndCommentStatus(Long parentCommentId, String status);
    long countByParentCommentIdAndCommentStatus(Long parentCommentId, String status);
}
