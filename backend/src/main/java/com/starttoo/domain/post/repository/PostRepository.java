package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.PostEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostRepository extends JpaRepository<PostEntity, Long> {
    @Query("""
            select p from PostEntity p join UserEntity u on u.userId=p.authorId
            where p.postStatus='PUBLISHED' and u.accountStatus='ACTIVE'
              and (:postType is null or p.postType=:postType)
              and (:authorId is null or p.authorId=:authorId)
              and p.postId < :cursor
            """)
    List<PostEntity> findPublic(@Param("postType") String postType, @Param("authorId") Long authorId,
                                @Param("cursor") Long cursor, Pageable pageable);

    @Query("""
            select p from PostEntity p join UserEntity u on u.userId=p.authorId
            where p.postStatus='PUBLISHED' and u.accountStatus='ACTIVE'
              and (:postType is null or p.postType=:postType)
              and (:authorId is null or p.authorId=:authorId)
            """)
    Slice<PostEntity> findPublicPage(@Param("postType") String postType, @Param("authorId") Long authorId,
                                    Pageable pageable);

    List<PostEntity> findAllByAuthorIdAndPostIdLessThanAndPostStatusNotOrderByPostIdDesc(
            Long authorId, Long cursor, String excludedStatus, Pageable pageable);

    List<PostEntity> findAllByAuthorIdAndPostStatusOrderByPostIdDesc(Long authorId, String status, Pageable pageable);
}
