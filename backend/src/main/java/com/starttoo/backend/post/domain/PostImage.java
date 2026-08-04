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
@Table(name = "post_images")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class PostImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_image_seq")
    private Long postImageSeq;

    @Column(name = "post_seq", nullable = false)
    private Long postSeq;

    @Column(name = "image_seq", nullable = false, unique = true)
    private Long imageSeq;

    @Column(name = "display_order", nullable = false)
    private short displayOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification_status", nullable = false, length = 20)
    private ClassificationStatus classificationStatus;

    @Column(name = "classification_attempt_count", nullable = false)
    private short classificationAttemptCount;

    @Column(name = "classification_mod_dttm")
    private OffsetDateTime classificationModDttm;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;
}
