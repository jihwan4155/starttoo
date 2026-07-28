package com.starttoo.domain.user.repository;

import com.starttoo.domain.user.entity.UserDeviceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserDeviceRepository extends JpaRepository<UserDeviceEntity, Long> {
    Optional<UserDeviceEntity> findByPushToken(String pushToken);

    List<UserDeviceEntity> findAllByUserIdAndActiveTrue(Long userId);

    Optional<UserDeviceEntity> findByDeviceIdAndUserId(Long deviceId, Long userId);
}
