package com.starttoo.backend.post.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PostRepository extends JpaRepository<Post, Long> {
    Optional<Post> findByPostSeqAndPostStatus(Long postSeq, PostStatus postStatus);

    Optional<Post> findByPostSeq(Long postSeq);

    @Modifying
    @Query("update Post p set p.likeCount = p.likeCount + :delta where p.postSeq = :postSeq and p.likeCount + :delta >= 0")
    int addLikeCount(@Param("postSeq") Long postSeq, @Param("delta") int delta);

    @Modifying
    @Query("update Post p set p.commentCount = p.commentCount + :delta where p.postSeq = :postSeq and p.commentCount + :delta >= 0")
    int addCommentCount(@Param("postSeq") Long postSeq, @Param("delta") int delta);

    @Modifying
    @Query("update Post p set p.reportCount = p.reportCount + :delta where p.postSeq = :postSeq and p.reportCount + :delta >= 0")
    int addReportCount(@Param("postSeq") Long postSeq, @Param("delta") int delta);
}
