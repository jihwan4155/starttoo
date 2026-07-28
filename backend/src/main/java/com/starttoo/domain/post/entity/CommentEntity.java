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
@Table(name = "comments")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class CommentEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "comment_id")
    private Long commentId;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Column(name = "parent_comment_id")
    private Long parentCommentId;

    @Column(name = "content", nullable = false, length = 1000)
    private String content;

    @Builder.Default
    @Column(name = "like_count", nullable = false)
    private long likeCount = 0L;

    @Builder.Default
    @Column(name = "comment_status", nullable = false, length = 20)
    private String commentStatus = "PUBLISHED";

    public void delete() {
        this.commentStatus = "DELETED";
    }

    public void incrementLikeCount() { this.likeCount++; }
    public void decrementLikeCount() { this.likeCount = Math.max(0L, this.likeCount - 1); }
}
