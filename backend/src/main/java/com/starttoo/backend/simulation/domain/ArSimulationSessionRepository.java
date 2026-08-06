package com.starttoo.backend.simulation.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface ArSimulationSessionRepository extends JpaRepository<ArSimulationSession, Long> {

    Optional<ArSimulationSession> findBySessionId(UUID sessionId);

    /**
     * connect 와 업로드는 비로그인 진입점이라 같은 sessionId 로 동시에 들어올 수 있다.
     * "최초 1대만 허용"과 업로드 횟수 상한이 경쟁 조건으로 뚫리지 않게 행을 잠근다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM ArSimulationSession s WHERE s.sessionId = :sessionId")
    Optional<ArSimulationSession> findBySessionIdForUpdate(UUID sessionId);
}
