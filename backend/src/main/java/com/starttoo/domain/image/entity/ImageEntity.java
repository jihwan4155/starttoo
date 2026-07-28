package com.starttoo.domain.image.entity;

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
@Table(name = "images")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ImageEntity extends CreatedAtEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "image_id")
    private Long imageId;

    @Column(name = "object_key", nullable = false, length = 1000)
    private String objectKey;

    @Builder.Default
    @Column(name = "is_used_for_training", nullable = false)
    private boolean usedForTraining = false;

    @Column(name = "trained_at")
    private LocalDateTime trainedAt;

    public boolean completeTraining(LocalDateTime now) {
        if (usedForTraining) {
            return false;
        }
        this.usedForTraining = true;
        this.trainedAt = now;
        return true;
    }
}
