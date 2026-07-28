package com.starttoo.domain.post.entity;

import com.starttoo.common.persistence.BaseTimeEntity;
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

@Getter
@Entity
@Table(name = "posts")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class PostEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long postId;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Column(name = "post_type", nullable = false, length = 20)
    private String postType;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Builder.Default
    @Column(name = "post_status", nullable = false, length = 20)
    private String postStatus = "PUBLISHED";

    @Builder.Default
    @Column(name = "like_count", nullable = false)
    private long likeCount = 0L;

    @Builder.Default
    @Column(name = "comment_count", nullable = false)
    private long commentCount = 0L;

    @Builder.Default
    @Column(name = "report_count", nullable = false)
    private long reportCount = 0L;

    public void update(String postType, String content) {
        this.postType = postType;
        this.content = content;
    }

    public void delete() {
        this.postStatus = "DELETED";
    }

    public void hideByModeration() {
        if (!"DELETED".equals(this.postStatus)) {
            this.postStatus = "HIDDEN";
        }
    }

    public void incrementLikeCount() { this.likeCount++; }
    public void decrementLikeCount() { this.likeCount = Math.max(0L, this.likeCount - 1); }
    public void incrementCommentCount() { this.commentCount++; }
    public void decrementCommentCount() { this.commentCount = Math.max(0L, this.commentCount - 1); }
    public void decrementCommentCount(long count) { this.commentCount = Math.max(0L, this.commentCount - count); }
    public void incrementReportCount() { this.reportCount++; }
}
