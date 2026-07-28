package com.starttoo.domain.tattoo.entity;

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
@Table(name = "tattoo_collections")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class TattooCollectionEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "collection_id")
    private Long collectionId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "body_part", nullable = false, length = 50)
    private String bodyPart;

    @Column(name = "collection_image_id", nullable = false)
    private Long collectionImageId;

    public void update(String bodyPart, Long collectionImageId) {
        this.bodyPart = bodyPart;
        this.collectionImageId = collectionImageId;
    }
}
