package com.starttoo.domain.user.repository;

import com.starttoo.domain.user.entity.UserTattooPreferenceEntity;
import com.starttoo.domain.user.entity.UserTattooPreferenceId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserTattooPreferenceRepository extends JpaRepository<UserTattooPreferenceEntity, UserTattooPreferenceId> {
    List<UserTattooPreferenceEntity> findAllByIdUserIdAndIdPreferenceSource(Long userId, String preferenceSource);
    void deleteAllByIdUserIdAndIdPreferenceSource(Long userId, String preferenceSource);
}
