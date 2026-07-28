package com.starttoo.domain.post.entity;

import com.starttoo.common.persistence.CreatedAtEntity;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "post_hidden_preferences")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class PostHiddenPreferenceEntity extends CreatedAtEntity {

    @EmbeddedId
    private PostUserId id;
}

