package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.PostImageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PostImageRepository extends JpaRepository<PostImageEntity, Long> {
    List<PostImageEntity> findAllByPostIdOrderByDisplayOrderAsc(Long postId);
    List<PostImageEntity> findAllByPostIdInOrderByPostIdAscDisplayOrderAsc(List<Long> postIds);
    void deleteAllByPostId(Long postId);
}
