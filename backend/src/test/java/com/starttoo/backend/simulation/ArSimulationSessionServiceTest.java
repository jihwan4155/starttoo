package com.starttoo.backend.simulation;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.api.MediaDtos;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.simulation.api.SimulationDtos;
import com.starttoo.backend.simulation.application.ArSessionTokenService;
import com.starttoo.backend.simulation.application.ArSimulationCompositeRegistrationService;
import com.starttoo.backend.simulation.application.ArSimulationSessionService;
import com.starttoo.backend.simulation.application.SimulationRealtimeEventPublisher;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ArSimulationSessionServiceTest {

    private static final Integer OWNER_SEQ = 7;

    private ArSimulationSessionRepository sessionRepository;
    private ArSimulationSessionDesignRepository designRepository;
    private ArSimulationCompositeRepository compositeRepository;
    private ArSimulationCompositeRegistrationService compositeRegistrationService;
    private TattooDesignRepository tattooDesignRepository;
    private ImageRepository imageRepository;
    private MediaService mediaService;
    private ArSessionTokenService tokenService;
    private SimulationRealtimeEventPublisher realtimeEventPublisher;
    private ArSimulationSessionService service;

    @BeforeEach
    void setUp() {
        sessionRepository = mock(ArSimulationSessionRepository.class);
        designRepository = mock(ArSimulationSessionDesignRepository.class);
        compositeRepository = mock(ArSimulationCompositeRepository.class);
        compositeRegistrationService = mock(ArSimulationCompositeRegistrationService.class);
        tattooDesignRepository = mock(TattooDesignRepository.class);
        imageRepository = mock(ImageRepository.class);
        mediaService = mock(MediaService.class);
        tokenService = mock(ArSessionTokenService.class);
        realtimeEventPublisher = mock(SimulationRealtimeEventPublisher.class);
        service = new ArSimulationSessionService(
                sessionRepository,
                designRepository,
                compositeRepository,
                compositeRegistrationService,
                tattooDesignRepository,
                imageRepository,
                mediaService,
                tokenService,
                realtimeEventPublisher,
                new SimulationProperties(
                        Duration.ofMinutes(10),
                        20,
                        2,
                        Duration.ofHours(1)
                )
        );
    }

    @Test
    void createIssuesUnguessableSessionIdBoundToTheOwner() {
        when(tattooDesignRepository.findAllByTattooSeqInAndDeletedFalse(anyCollection()))
                .thenReturn(List.of(design(501L, 301L)));
        when(sessionRepository.saveAndFlush(any(ArSimulationSession.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        SimulationDtos.CreateArSessionResponse response = service.create(
                OWNER_SEQ,
                new SimulationDtos.CreateArSessionRequest(List.of(501L, 501L))
        );

        assertThat(response.sessionId()).isNotNull();
        assertThat(response.expiresInSeconds()).isBetween(1, 600);
        // 중복 designSeq 는 한 번만 저장한다.
        verify(designRepository).saveAll(argThatHasSize(1));
    }

    @Test
    void createRejectsDesignsThatNoLongerExist() {
        when(tattooDesignRepository.findAllByTattooSeqInAndDeletedFalse(anyCollection()))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.create(
                OWNER_SEQ,
                new SimulationDtos.CreateArSessionRequest(List.of(501L))
        ))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.TATTOO_NOT_FOUND);
        verify(sessionRepository, never()).saveAndFlush(any());
    }

    @Test
    void connectIssuesTokenAndHandsOverTheDesignsThePcPicked() {
        ArSimulationSession session = openSession();
        UUID tokenId = UUID.randomUUID();
        when(sessionRepository.findBySessionIdForUpdate(session.getSessionId()))
                .thenReturn(Optional.of(session));
        when(tokenService.issue(eq(session.getSessionId()), eq(OWNER_SEQ), any(Duration.class)))
                .thenReturn(new ArSessionTokenService.IssuedToken("session.jwt", tokenId));
        when(designRepository.findAllByArSessionSeqOrderBySortOrderAsc(1L))
                .thenReturn(List.of(sessionDesign(501L)));
        when(tattooDesignRepository.findAllByTattooSeqInAndDeletedFalse(anyCollection()))
                .thenReturn(List.of(design(501L, 301L)));
        when(imageRepository.findAllById(anyCollection()))
                .thenReturn(List.of(image(301L, "users/7/collection/design.png")));
        when(mediaService.presignedDownload(eq("users/7/collection/design.png"), any(Duration.class)))
                .thenReturn(new MediaService.PresignedDownload(
                        "https://minio.example/design.png",
                        OffsetDateTime.now().plusHours(1)
                ));

        SimulationDtos.ConnectArSessionResponse response = service.connect(session.getSessionId());

        assertThat(response.sessionToken()).isEqualTo("session.jwt");
        assertThat(response.designs())
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.designSeq()).isEqualTo(501L);
                    assertThat(item.imageUrl()).isEqualTo("https://minio.example/design.png");
                });
        assertThat(session.getStatus()).isEqualTo(ArSimulationSessionStatus.CONNECTED);
        assertThat(session.getSessionTokenId()).isEqualTo(tokenId);
        verify(realtimeEventPublisher).phoneConnected(OWNER_SEQ, session.getSessionId());
    }

    /** QR 만 찍으면 남의 세션에 붙는 상황을 막는 핵심 규칙이다. */
    @Test
    void secondPhoneCannotJoinAnAlreadyConnectedSession() {
        ArSimulationSession session = openSession();
        session.connectPhone(UUID.randomUUID());
        when(sessionRepository.findBySessionIdForUpdate(session.getSessionId()))
                .thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.connect(session.getSessionId()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.STATE_CONFLICT);
        verify(tokenService, never()).issue(any(), any(), any());
    }

    @Test
    void connectOnExpiredSessionIsGone() {
        ArSimulationSession session = expiredSession();
        when(sessionRepository.findBySessionIdForUpdate(session.getSessionId()))
                .thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.connect(session.getSessionId()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.SESSION_EXPIRED);
    }

    @Test
    void presignBuildsTheUploadUrlUnderTheSessionOwnerPath() {
        ArSimulationSession session = connectedSession();
        when(sessionRepository.findBySessionId(session.getSessionId()))
                .thenReturn(Optional.of(session));
        when(tokenService.verify("Session token", session.getSessionId()))
                .thenReturn(session.getSessionTokenId());
        when(mediaService.presign(eq(OWNER_SEQ), any(MediaDtos.PresignUploadRequest.class)))
                .thenReturn(new MediaDtos.PresignUploadResponse(
                        "users/7/simulation/uuid.png",
                        "https://minio.example/upload",
                        java.util.Map.of("Content-Type", "image/png"),
                        600
                ));

        SimulationDtos.CompositePresignResponse response = service.presignComposite(
                session.getSessionId(),
                "Session token",
                new SimulationDtos.CompositePresignRequest("image/png", "capture.png", 1024L)
        );

        assertThat(response.objectKey()).startsWith("users/7/simulation/");
        assertThat(response.uploadUrl()).isEqualTo("https://minio.example/upload");
    }

    @Test
    void uploadIsRejectedOnceTheSessionHitsItsCompositeLimit() {
        ArSimulationSession session = connectedSession();
        session.addComposite();
        session.addComposite();
        when(sessionRepository.findBySessionId(session.getSessionId()))
                .thenReturn(Optional.of(session));
        when(tokenService.verify("Session token", session.getSessionId()))
                .thenReturn(session.getSessionTokenId());

        assertThatThrownBy(() -> service.createComposite(
                session.getSessionId(),
                "Session token",
                new SimulationDtos.CreateCompositeRequest("users/7/simulation/uuid.png")
        ))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.STATE_CONFLICT);
        verify(mediaService, never()).complete(any(), any());
    }

    /** 세션을 닫으면 JWT 가 아직 살아 있어도 폰 요청이 즉시 끊겨야 한다. */
    @Test
    void tokenOfAClosedSessionNoLongerUploads() {
        ArSimulationSession session = connectedSession();
        UUID tokenId = session.getSessionTokenId();
        session.close();
        when(sessionRepository.findBySessionId(session.getSessionId()))
                .thenReturn(Optional.of(session));
        when(tokenService.verify("Session token", session.getSessionId())).thenReturn(tokenId);

        assertThatThrownBy(() -> service.createComposite(
                session.getSessionId(),
                "Session token",
                new SimulationDtos.CreateCompositeRequest("users/7/simulation/uuid.png")
        ))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.SESSION_EXPIRED);
    }

    @Test
    void createCompositeVerifiesTheObjectBeforeTheWriteTransaction() {
        ArSimulationSession session = connectedSession();
        OffsetDateTime uploadedAt = OffsetDateTime.now();
        when(sessionRepository.findBySessionId(session.getSessionId()))
                .thenReturn(Optional.of(session));
        when(tokenService.verify("Session token", session.getSessionId()))
                .thenReturn(session.getSessionTokenId());
        when(mediaService.complete(eq(OWNER_SEQ), any(MediaDtos.CompleteUploadRequest.class)))
                .thenReturn(new MediaDtos.ImageResponse(
                        3201L,
                        "users/7/simulation/uuid.png",
                        "https://minio.example/composite.png",
                        uploadedAt
                ));
        when(compositeRegistrationService.register(
                session.getSessionId(),
                session.getSessionTokenId(),
                3201L,
                "https://minio.example/composite.png"
        )).thenReturn(9001L);

        SimulationDtos.CompositeResponse response = service.createComposite(
                session.getSessionId(),
                "Session token",
                new SimulationDtos.CreateCompositeRequest("users/7/simulation/uuid.png")
        );

        assertThat(response.compositeSeq()).isEqualTo(9001L);
        assertThat(response.imageUrl()).isEqualTo("https://minio.example/composite.png");
        assertThat(response.regDttm()).isEqualTo(uploadedAt);
    }

    /** 재접속 복구용 조회다. 만료됐다고 410 을 주면 PC 가 결과를 되찾을 길이 없다. */
    @Test
    void stateReportsExpiredWithoutHidingTheCollectedComposites() {
        ArSimulationSession session = expiredSession();
        when(sessionRepository.findBySessionId(session.getSessionId()))
                .thenReturn(Optional.of(session));
        when(designRepository.findAllByArSessionSeqOrderBySortOrderAsc(1L))
                .thenReturn(List.of());
        when(compositeRepository.findAllByArSessionSeqOrderByArCompositeSeqAsc(1L))
                .thenReturn(List.of(composite(9001L, 3201L)));
        when(imageRepository.findAllById(anyCollection()))
                .thenReturn(List.of(image(3201L, "users/7/simulation/uuid.png")));
        when(mediaService.downloadUrl("users/7/simulation/uuid.png"))
                .thenReturn("https://minio.example/composite.png");

        SimulationDtos.ArSessionStateResponse response =
                service.state(OWNER_SEQ, session.getSessionId());

        assertThat(response.status()).isEqualTo(SimulationDtos.ArSessionStatus.EXPIRED);
        assertThat(response.expiresInSeconds()).isZero();
        assertThat(response.composites()).singleElement()
                .satisfies(item -> assertThat(item.imageUrl())
                        .isEqualTo("https://minio.example/composite.png"));
    }

    @Test
    void anotherMemberCannotReadTheSessionState() {
        ArSimulationSession session = openSession();
        when(sessionRepository.findBySessionId(session.getSessionId()))
                .thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.state(99, session.getSessionId()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    void closingAnAlreadyClosedSessionDoesNotPublishTwice() {
        ArSimulationSession session = connectedSession();
        session.close();
        when(sessionRepository.findBySessionIdForUpdate(session.getSessionId()))
                .thenReturn(Optional.of(session));

        service.close(OWNER_SEQ, session.getSessionId());

        verify(realtimeEventPublisher, never()).sessionClosed(any(), any());
    }

    private List<ArSimulationSessionDesign> argThatHasSize(int size) {
        return org.mockito.ArgumentMatchers.argThat(
                argument -> argument != null && ((List<?>) argument).size() == size
        );
    }

    private ArSimulationSession openSession() {
        OffsetDateTime now = OffsetDateTime.now();
        return ArSimulationSession.builder()
                .arSessionSeq(1L)
                .sessionId(UUID.randomUUID())
                .ownerSeq(OWNER_SEQ)
                .status(ArSimulationSessionStatus.CREATED)
                .compositeCount((short) 0)
                .expiresDttm(now.plusMinutes(10))
                .regDttm(now)
                .modDttm(now)
                .build();
    }

    private ArSimulationSession connectedSession() {
        ArSimulationSession session = openSession();
        session.connectPhone(UUID.randomUUID());
        return session;
    }

    private ArSimulationSession expiredSession() {
        OffsetDateTime now = OffsetDateTime.now();
        return ArSimulationSession.builder()
                .arSessionSeq(1L)
                .sessionId(UUID.randomUUID())
                .ownerSeq(OWNER_SEQ)
                .status(ArSimulationSessionStatus.CREATED)
                .compositeCount((short) 0)
                .expiresDttm(now.minusMinutes(1))
                .regDttm(now.minusMinutes(11))
                .modDttm(now.minusMinutes(11))
                .build();
    }

    private ArSimulationSessionDesign sessionDesign(Long tattooSeq) {
        return ArSimulationSessionDesign.builder()
                .arSessionDesignSeq(1L)
                .arSessionSeq(1L)
                .tattooSeq(tattooSeq)
                .sortOrder((short) 0)
                .regDttm(OffsetDateTime.now())
                .build();
    }

    private TattooDesign design(Long tattooSeq, Long imageSeq) {
        return TattooDesign.builder()
                .tattooSeq(tattooSeq)
                .imageSeq(imageSeq)
                .regDttm(OffsetDateTime.now())
                .modDttm(OffsetDateTime.now())
                .deleted(false)
                .indexed(false)
                .build();
    }

    private ArSimulationComposite composite(Long compositeSeq, Long imageSeq) {
        return ArSimulationComposite.builder()
                .arCompositeSeq(compositeSeq)
                .arSessionSeq(1L)
                .imageSeq(imageSeq)
                .regDttm(OffsetDateTime.now())
                .build();
    }

    private Image image(Long imageSeq, String objectKey) {
        return Image.builder()
                .imageSeq(imageSeq)
                .objectKey(objectKey)
                .regDttm(OffsetDateTime.now())
                .regUsrSeq(OWNER_SEQ)
                .modDttm(OffsetDateTime.now())
                .modUsrSeq(OWNER_SEQ)
                .deleted(false)
                .build();
    }
}
