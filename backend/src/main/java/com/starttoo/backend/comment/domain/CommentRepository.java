package com.starttoo.backend.comment.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    Optional<Comment> findByCommentSeq(Long commentSeq);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Comment c where c.commentSeq = :commentSeq")
    Optional<Comment> findForUpdate(@Param("commentSeq") Long commentSeq);

    @Modifying
    @Query("update Comment c set c.likeCount = c.likeCount + :delta where c.commentSeq = :commentSeq and c.likeCount + :delta >= 0")
    int addLikeCount(@Param("commentSeq") Long commentSeq, @Param("delta") int delta);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Comment c
               set c.commentStatus = com.starttoo.backend.comment.domain.CommentStatus.DELETED,
                   c.deleted = true,
                   c.modUsrSeq = :modifierSeq,
                   c.modDttm = :modifiedDttm
             where c.commentSeq = :commentSeq
               and c.authorSeq = :authorSeq
               and c.deleted = false
            """)
    int softDelete(
            @Param("commentSeq") Long commentSeq,
            @Param("authorSeq") Integer authorSeq,
            @Param("modifierSeq") Integer modifierSeq,
            @Param("modifiedDttm") OffsetDateTime modifiedDttm
    );
}
