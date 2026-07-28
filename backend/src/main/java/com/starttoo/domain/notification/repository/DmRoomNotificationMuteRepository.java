package com.starttoo.domain.notification.repository;

import com.starttoo.domain.notification.entity.DmRoomNotificationMuteEntity;
import com.starttoo.domain.notification.entity.DmRoomNotificationMuteId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DmRoomNotificationMuteRepository
        extends JpaRepository<DmRoomNotificationMuteEntity, DmRoomNotificationMuteId> {
}
