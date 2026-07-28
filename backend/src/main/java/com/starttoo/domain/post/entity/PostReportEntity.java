package com.starttoo.domain.post.entity;

import com.starttoo.common.persistence.CreatedAtEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "post_reports")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class PostReportEntity extends CreatedAtEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_id")
    private Long reportId;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Column(name = "reason_code", nullable = false, length = 50)
    private String reasonCode;

    @Column(name = "reason_detail", length = 1000)
    private String reasonDetail;

    @Builder.Default
    @Column(name = "report_status", nullable = false, length = 20)
    private String reportStatus = "PENDING";

    @Column(name = "processing_note", length = 1000)
    private String processingNote;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    public void process(String decision, String processingNote, LocalDateTime processedAt) {
        this.reportStatus = decision;
        this.processingNote = processingNote;
        this.processedAt = processedAt;
    }
}
