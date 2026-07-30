package com.starttoo.backend.comment.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    Optional<Comment> findByCommentSeq(Long commentSeq);

    @Modifying
    @Query("update Comment c set c.likeCount = c.likeCount + :delta where c.commentSeq = :commentSeq and c.likeCount + :delta >= 0")
    int addLikeCount(@Param("commentSeq") Long commentSeq, @Param("delta") int delta);
}
