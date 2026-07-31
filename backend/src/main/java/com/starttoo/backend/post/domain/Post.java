package com.starttoo.backend.post.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@Builder
@Entity
@Table(name = "posts")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_seq")
    private Long postSeq;

    @Column(name = "author_seq", nullable = false)
    private Integer authorSeq;

    @Column(length = 3000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "post_status", nullable = false, length = 12)
    private PostStatus postStatus;

    @Column(name = "like_count", nullable = false)
    private int likeCount;

    @Column(name = "comment_count", nullable = false)
    private int commentCount;

    @Column(name = "report_count", nullable = false)
    private int reportCount;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "mod_usr_seq", nullable = false)
    private Integer modUsrSeq;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

}
