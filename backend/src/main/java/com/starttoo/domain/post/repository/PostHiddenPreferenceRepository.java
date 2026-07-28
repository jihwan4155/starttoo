package com.starttoo.domain.post.repository;

import com.starttoo.domain.post.entity.PostHiddenPreferenceEntity;
import com.starttoo.domain.post.entity.PostUserId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostHiddenPreferenceRepository extends JpaRepository<PostHiddenPreferenceEntity, PostUserId> {
}

