package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.PostReportEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PostReportRepository extends JpaRepository<PostReportEntity, Long> {
    boolean existsByPostIdAndReporterId(Long postId, Long reporterId);

    @Query(value = """
            select r.postId
            from PostReportEntity r
            where r.reportStatus = :status
            group by r.postId
            order by max(r.createdAt) desc, r.postId desc
            """, countQuery = """
            select count(distinct r.postId)
            from PostReportEntity r
            where r.reportStatus = :status
            """)
    Page<Long> findReportedPostIdsLatest(
            @Param("status") String status,
            Pageable pageable
    );

    @Query(value = """
            select r.postId
            from PostReportEntity r
            join PostEntity p on p.postId = r.postId
            where r.reportStatus = :status
            group by r.postId, p.reportCount
            order by p.reportCount desc, r.postId desc
            """, countQuery = """
            select count(distinct r.postId)
            from PostReportEntity r
            where r.reportStatus = :status
            """)
    Page<Long> findReportedPostIdsMostReported(
            @Param("status") String status,
            Pageable pageable
    );

    List<PostReportEntity> findAllByPostIdInAndReportStatusOrderByCreatedAtDescReportIdDesc(
            List<Long> postIds,
            String reportStatus
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<PostReportEntity> findAllByPostIdAndReportStatusOrderByReportIdAsc(
            Long postId,
            String reportStatus
    );
}
