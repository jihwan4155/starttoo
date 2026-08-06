package com.starttoo.backend.simulation.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.simulation.api.SimulationDtos;
import com.starttoo.backend.simulation.config.SimulationProperties;
import com.starttoo.backend.simulation.domain.ArSimulationComposite;
import com.starttoo.backend.simulation.domain.ArSimulationCompositeRepository;
import com.starttoo.backend.simulation.domain.ArSimulationSession;
import com.starttoo.backend.simulation.domain.ArSimulationSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * MinIO 검증·등록을 트랜잭션 밖에서 끝낸 뒤 실행되는 짧은 쓰기 트랜잭션이다.
 * 업로드 상한과 세션 상태는 여기서 잠금을 잡고 한 번 더 확인한다. 사전 검사만으로는
 * 같은 sessionToken 으로 동시에 밀어 넣는 요청을 막지 못한다.
 */
@Service
@RequiredArgsConstructor
public class ArSimulationCompositeRegistrationService {

    private final ArSimulationSessionRepository sessionRepository;
    private final ArSimulationCompositeRepository compositeRepository;
    private final SimulationRealtimeEventPublisher realtimeEventPublisher;
    private final SimulationProperties properties;

    @Transactional
    public Long register(UUID sessionId, UUID sessionTokenId, Long imageSeq, String imageUrl) {
        ArSimulationSession session = sessionRepository.findBySessionIdForUpdate(sessionId)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        requireUsable(session, sessionTokenId);
        if (session.getCompositeCount() >= properties.maxComposites()) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        OffsetDateTime now = OffsetDateTime.now();
        ArSimulationComposite composite = compositeRepository.saveAndFlush(
                ArSimulationComposite.builder()
                        .arSessionSeq(session.getArSessionSeq())
                        .imageSeq(imageSeq)
                        .regDttm(now)
                        .build()
        );
        session.addComposite();
        realtimeEventPublisher.compositeCreated(
                session.getOwnerSeq(),
                sessionId,
                new SimulationDtos.CompositeResponse(
                        composite.getArCompositeSeq(),
                        imageSeq,
                        imageUrl,
                        now
                )
        );
        return composite.getArCompositeSeq();
    }

    private void requireUsable(ArSimulationSession session, UUID sessionTokenId) {
        if (session.isClosed() || session.isExpiredAt(OffsetDateTime.now())) {
            throw BusinessException.of(ErrorCode.SESSION_EXPIRED);
        }
        if (!sessionTokenId.equals(session.getSessionTokenId())) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
    }
}
