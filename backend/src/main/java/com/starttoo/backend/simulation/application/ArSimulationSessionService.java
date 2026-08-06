package com.starttoo.backend.simulation.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.api.MediaDtos;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.simulation.api.SimulationDtos;
import com.starttoo.backend.simulation.config.SimulationProperties;
import com.starttoo.backend.simulation.domain.ArSimulationComposite;
import com.starttoo.backend.simulation.domain.ArSimulationCompositeRepository;
import com.starttoo.backend.simulation.domain.ArSimulationSession;
import com.starttoo.backend.simulation.domain.ArSimulationSessionDesign;
import com.starttoo.backend.simulation.domain.ArSimulationSessionDesignRepository;
import com.starttoo.backend.simulation.domain.ArSimulationSessionRepository;
import com.starttoo.backend.simulation.domain.ArSimulationSessionStatus;
import com.starttoo.backend.tattoo.domain.TattooDesign;
import com.starttoo.backend.tattoo.domain.TattooDesignRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * QR 로 붙는 폰은 로그인이 없다. PC(JWT)가 만든 단기 세션의 sessionId 로 폰이 접속하고,
 * 그 세션에서만 통하는 sessionToken 으로 업로드까지 마친다. 결과는 PC 개인 큐로 밀어준다.
 */
@Service
@RequiredArgsConstructor
public class ArSimulationSessionService {

    private final ArSimulationSessionRepository sessionRepository;
    private final ArSimulationSessionDesignRepository designRepository;
    private final ArSimulationCompositeRepository compositeRepository;
    private final ArSimulationCompositeRegistrationService compositeRegistrationService;
    private final TattooDesignRepository tattooDesignRepository;
    private final ImageRepository imageRepository;
    private final MediaService mediaService;
    private final ArSessionTokenService tokenService;
    private final SimulationRealtimeEventPublisher realtimeEventPublisher;
    private final SimulationProperties properties;

    @Transactional
    public SimulationDtos.CreateArSessionResponse create(
            Integer ownerSeq,
            SimulationDtos.CreateArSessionRequest request
    ) {
        List<Long> designSeqs = distinctDesignSeqs(request.designSeqs());
        if (designSeqs.size() > properties.maxDesigns()) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        requireActiveDesigns(designSeqs);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plus(properties.sessionTtl());
        ArSimulationSession session = sessionRepository.saveAndFlush(
                ArSimulationSession.builder()
                        .sessionId(UUID.randomUUID())
                        .ownerSeq(ownerSeq)
                        .status(ArSimulationSessionStatus.CREATED)
                        .compositeCount((short) 0)
                        .expiresDttm(expiresAt)
                        .regDttm(now)
                        .modDttm(now)
                        .build()
        );
        List<ArSimulationSessionDesign> designs = new ArrayList<>();
        for (int index = 0; index < designSeqs.size(); index++) {
            designs.add(ArSimulationSessionDesign.builder()
                    .arSessionSeq(session.getArSessionSeq())
                    .tattooSeq(designSeqs.get(index))
                    .sortOrder((short) index)
                    .regDttm(now)
                    .build());
        }
        designRepository.saveAll(designs);
        return new SimulationDtos.CreateArSessionResponse(
                session.getSessionId(),
                remainingSeconds(expiresAt, now),
                expiresAt
        );
    }

    /**
     * 폰이 QR 로 붙는 유일한 진입점이다. 최초 1대만 성공하고 이후 요청은 409 로 거부한다.
     */
    @Transactional
    public SimulationDtos.ConnectArSessionResponse connect(UUID sessionId) {
        ArSimulationSession session = sessionRepository.findBySessionIdForUpdate(sessionId)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        OffsetDateTime now = OffsetDateTime.now();
        if (session.isClosed() || session.isExpiredAt(now)) {
            throw BusinessException.of(ErrorCode.SESSION_EXPIRED);
        }
        if (session.isPhoneConnected()) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        // 토큰이 세션보다 오래 살면 안 된다. 남은 세션 시간만큼만 발급한다.
        Duration remaining = Duration.between(now, session.getExpiresDttm());
        ArSessionTokenService.IssuedToken token = tokenService.issue(
                sessionId,
                session.getOwnerSeq(),
                remaining
        );
        if (!session.connectPhone(token.tokenId())) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        realtimeEventPublisher.phoneConnected(session.getOwnerSeq(), sessionId);
        return new SimulationDtos.ConnectArSessionResponse(
                token.value(),
                remainingSeconds(session.getExpiresDttm(), now),
                session.getExpiresDttm(),
                designs(session)
        );
    }

    /**
     * 폰이 MinIO 로 직접 PUT 할 URL 을 발급한다. 회원 presign 과 같은 규칙·같은 응답 모양이며
     * 소유자는 세션을 만든 PC 회원이다. 합성 결과는 결국 그 회원의 자산이다.
     */
    public SimulationDtos.CompositePresignResponse presignComposite(
            UUID sessionId,
            String authorizationHeader,
            SimulationDtos.CompositePresignRequest request
    ) {
        UUID tokenId = tokenService.verify(authorizationHeader, sessionId);
        ArSimulationSession session = requireTokenSession(sessionId, tokenId);
        if (session.getCompositeCount() >= properties.maxComposites()) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        MediaDtos.PresignUploadResponse presigned = mediaService.presign(
                session.getOwnerSeq(),
                new MediaDtos.PresignUploadRequest(
                        MediaDtos.UploadPurpose.SIMULATION,
                        request.contentType(),
                        request.originalFilename(),
                        request.fileSize()
                )
        );
        return new SimulationDtos.CompositePresignResponse(
                presigned.objectKey(),
                presigned.uploadUrl(),
                presigned.requiredHeaders(),
                presigned.expiresInSeconds()
        );
    }

    /**
     * MinIO 검증과 images 등록을 트랜잭션 밖에서 끝낸 뒤 짧은 쓰기 트랜잭션으로 합성 결과를
     * 남긴다. 세션 잠금을 잡은 채로 외부 저장소를 왕복하지 않기 위한 순서다.
     */
    public SimulationDtos.CompositeResponse createComposite(
            UUID sessionId,
            String authorizationHeader,
            SimulationDtos.CreateCompositeRequest request
    ) {
        UUID tokenId = tokenService.verify(authorizationHeader, sessionId);
        ArSimulationSession session = requireTokenSession(sessionId, tokenId);
        if (session.getCompositeCount() >= properties.maxComposites()) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        MediaDtos.ImageResponse image = mediaService.complete(
                session.getOwnerSeq(),
                new MediaDtos.CompleteUploadRequest(request.objectKey())
        );
        Long compositeSeq = compositeRegistrationService.register(
                sessionId,
                tokenId,
                image.imageSeq(),
                image.downloadUrl()
        );
        return new SimulationDtos.CompositeResponse(
                compositeSeq,
                image.imageSeq(),
                image.downloadUrl(),
                image.regDttm()
        );
    }

    /**
     * 새로고침·재접속 시 PC 화면을 복구하는 조회다. 만료됐다고 410 을 주지 않고
     * {@code EXPIRED} 상태와 지금까지의 결과를 그대로 돌려준다.
     */
    @Transactional(readOnly = true)
    public SimulationDtos.ArSessionStateResponse state(Integer ownerSeq, UUID sessionId) {
        ArSimulationSession session = requireOwnedSession(ownerSeq, sessionId);
        OffsetDateTime now = OffsetDateTime.now();
        return new SimulationDtos.ArSessionStateResponse(
                session.getSessionId(),
                status(session, now),
                session.isPhoneConnected(),
                session.getPhoneConnectedDttm(),
                session.getExpiresDttm(),
                remainingSeconds(session.getExpiresDttm(), now),
                designs(session),
                composites(session)
        );
    }

    @Transactional
    public void close(Integer ownerSeq, UUID sessionId) {
        ArSimulationSession session = sessionRepository.findBySessionIdForUpdate(sessionId)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        if (!session.getOwnerSeq().equals(ownerSeq)) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        if (session.isClosed()) {
            return;
        }
        session.close();
        realtimeEventPublisher.sessionClosed(ownerSeq, sessionId);
    }

    private ArSimulationSession requireOwnedSession(Integer ownerSeq, UUID sessionId) {
        ArSimulationSession session = sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        if (!session.getOwnerSeq().equals(ownerSeq)) {
            // 남의 세션 존재 여부를 알려주지 않는다.
            throw BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND);
        }
        return session;
    }

    private ArSimulationSession requireTokenSession(UUID sessionId, UUID tokenId) {
        ArSimulationSession session = sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
        if (session.isClosed() || session.isExpiredAt(OffsetDateTime.now())) {
            throw BusinessException.of(ErrorCode.SESSION_EXPIRED);
        }
        if (!tokenId.equals(session.getSessionTokenId())) {
            throw BusinessException.of(ErrorCode.INVALID_TOKEN);
        }
        return session;
    }

    private List<Long> distinctDesignSeqs(List<Long> requested) {
        if (requested == null || requested.isEmpty()) {
            return List.of();
        }
        if (requested.stream().anyMatch(value -> value == null || value <= 0)) {
            throw BusinessException.of(ErrorCode.INVALID_REQUEST);
        }
        return List.copyOf(new LinkedHashSet<>(requested));
    }

    private void requireActiveDesigns(List<Long> designSeqs) {
        if (designSeqs.isEmpty()) {
            return;
        }
        long found = tattooDesignRepository
                .findAllByTattooSeqInAndDeletedFalse(designSeqs)
                .size();
        if (found != designSeqs.size()) {
            throw BusinessException.of(ErrorCode.TATTOO_NOT_FOUND);
        }
    }

    private List<SimulationDtos.ArSessionDesignResponse> designs(ArSimulationSession session) {
        List<ArSimulationSessionDesign> rows =
                designRepository.findAllByArSessionSeqOrderBySortOrderAsc(session.getArSessionSeq());
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<Long, Long> imageSeqByDesign = tattooDesignRepository
                .findAllByTattooSeqInAndDeletedFalse(
                        rows.stream().map(ArSimulationSessionDesign::getTattooSeq).toList()
                )
                .stream()
                .collect(Collectors.toMap(
                        TattooDesign::getTattooSeq,
                        TattooDesign::getImageSeq
                ));
        Map<Long, String> objectKeyByImage = objectKeys(imageSeqByDesign.values());
        return rows.stream()
                .map(row -> {
                    Long imageSeq = imageSeqByDesign.get(row.getTattooSeq());
                    String objectKey = imageSeq == null ? null : objectKeyByImage.get(imageSeq);
                    if (objectKey == null) {
                        // 세션 생성 이후 도안이 삭제된 경우다. 폰 화면에서 그 칸만 빠진다.
                        return null;
                    }
                    return new SimulationDtos.ArSessionDesignResponse(
                            row.getTattooSeq(),
                            mediaService
                                    .presignedDownload(objectKey, properties.designUrlExpiry())
                                    .url()
                    );
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private List<SimulationDtos.CompositeResponse> composites(ArSimulationSession session) {
        List<ArSimulationComposite> rows = compositeRepository
                .findAllByArSessionSeqOrderByArCompositeSeqAsc(session.getArSessionSeq());
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<Long, String> objectKeyByImage = objectKeys(
                rows.stream().map(ArSimulationComposite::getImageSeq).toList()
        );
        return rows.stream()
                .filter(row -> objectKeyByImage.containsKey(row.getImageSeq()))
                .map(row -> new SimulationDtos.CompositeResponse(
                        row.getArCompositeSeq(),
                        row.getImageSeq(),
                        mediaService.downloadUrl(objectKeyByImage.get(row.getImageSeq())),
                        row.getRegDttm()
                ))
                .toList();
    }

    private Map<Long, String> objectKeys(Collection<Long> imageSeqs) {
        if (imageSeqs.isEmpty()) {
            return Map.of();
        }
        return imageRepository.findAllById(imageSeqs).stream()
                .filter(image -> !image.isDeleted())
                .collect(Collectors.toMap(Image::getImageSeq, Image::getObjectKey));
    }

    private SimulationDtos.ArSessionStatus status(
            ArSimulationSession session,
            OffsetDateTime now
    ) {
        if (session.isClosed()) {
            return SimulationDtos.ArSessionStatus.CLOSED;
        }
        if (session.isExpiredAt(now)) {
            return SimulationDtos.ArSessionStatus.EXPIRED;
        }
        return session.isPhoneConnected()
                ? SimulationDtos.ArSessionStatus.CONNECTED
                : SimulationDtos.ArSessionStatus.CREATED;
    }

    private int remainingSeconds(OffsetDateTime expiresAt, OffsetDateTime now) {
        long seconds = Duration.between(now, expiresAt).toSeconds();
        return seconds <= 0 ? 0 : Math.toIntExact(seconds);
    }
}
