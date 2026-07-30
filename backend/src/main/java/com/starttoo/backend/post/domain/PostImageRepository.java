package com.starttoo.backend.post.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostImageRepository extends JpaRepository<PostImage, Long> {
    List<PostImage> findAllByPostSeqOrderByDisplayOrder(Long postSeq);
}
