package com.starttoo.backend.simulation.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.simulation.application.ArSimulationSessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/v1/simulations/ar-sessions")
@RequiredArgsConstructor
@Tag(name = "AR Simulations", description = "QR 로 연결하는 비로그인 폰 AR 시뮬레이션 세션")
public class SimulationController {

    private final ArSimulationSessionService sessionService;

    @PostMapping
    @Operation(
            summary = "AR 세션 생성",
            description = """
                    PC 가 QR 에 실을 단기 세션을 만든다. sessionId 는 순번이 아니라 추측
                    불가능한 UUID 이며 로그인 회원에 묶인다. designSeqs 로 폰 보관함에 띄울
                    도안을 미리 지정하고, 삭제됐거나 없는 도안이 하나라도 있으면 404 로
                    끝낸다. 세션과 도안 저장은 한 트랜잭션이다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<SimulationDtos.CreateArSessionResponse> create(
            @Valid @RequestBody SimulationDtos.CreateArSessionRequest request
    ) {
        return ApiResponse.of(sessionService.create(SecurityUtils.currentUserSeq(), request));
    }

    @PostMapping("/{sessionId}/connect")
    @Operation(
            summary = "폰 세션 접속",
            description = """
                    QR 을 찍은 비로그인 폰이 sessionId 만으로 붙는다. 인증은 필요 없다.
                    세션당 최초 1대만 성공하며 이후 접속 요청은 409 다. 만료되었거나 닫힌
                    세션은 410 이다. 응답의 sessionToken 은 남은 세션 시간만큼만 유효하고
                    이 세션의 업로드 API 에서만 통한다. 같은 트랜잭션 커밋 이후 PC 개인
                    큐로 PHONE_CONNECTED 를 전달한다.
                    """
    )
    public ApiResponse<SimulationDtos.ConnectArSessionResponse> connect(
            @PathVariable UUID sessionId
    ) {
        return ApiResponse.of(sessionService.connect(sessionId));
    }

    @PostMapping("/{sessionId}/composites/presign")
    @Operation(
            summary = "합성 결과 업로드용 presigned PUT URL 발급",
            description = """
                    폰이 MinIO 에 직접 PUT 할 단기 URL 을 발급한다. Authorization 헤더에
                    `Session {sessionToken}` 이 필요하다. 회원 presign 과 같은 규칙으로
                    image/png|jpeg|webp 와 파일 크기 상한을 검증하고, objectKey 는 세션
                    소유자 경로인 users/{ownerSeq}/simulation/ 아래에 만든다. 세션당 업로드
                    상한에 닿으면 409 다. 이 단계에서는 images 행을 만들지 않는다.
                    """
    )
    public ApiResponse<SimulationDtos.CompositePresignResponse> presignComposite(
            @PathVariable UUID sessionId,
            // 헤더가 없으면 500이 아니라 서비스가 401로 끝내도록 required=false로 받는다.
            @Parameter(description = "`Session {sessionToken}` 형식", required = true)
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody SimulationDtos.CompositePresignRequest request
    ) {
        return ApiResponse.of(
                sessionService.presignComposite(sessionId, authorization, request)
        );
    }

    @PostMapping("/{sessionId}/composites")
    @Operation(
            summary = "합성 결과 등록",
            description = """
                    presign 으로 올린 객체를 확인하고 세션의 합성 결과로 남긴다.
                    Authorization 헤더에 `Session {sessionToken}` 이 필요하다. MinIO stat
                    으로 객체 존재·크기·Content-Type 을 검증하고 images 행을 세션 소유자
                    명의로 등록한 뒤에야 짧은 쓰기 트랜잭션에서 합성 결과 행을 만든다.
                    커밋 이후 PC 개인 큐로 COMPOSITE_CREATED 를 전달한다.
                    """
    )
    public ApiResponse<SimulationDtos.CompositeResponse> createComposite(
            @PathVariable UUID sessionId,
            // 헤더가 없으면 500이 아니라 서비스가 401로 끝내도록 required=false로 받는다.
            @Parameter(description = "`Session {sessionToken}` 형식", required = true)
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @Valid @RequestBody SimulationDtos.CreateCompositeRequest request
    ) {
        return ApiResponse.of(
                sessionService.createComposite(sessionId, authorization, request)
        );
    }

    @GetMapping("/{sessionId}")
    @Operation(
            summary = "AR 세션 상태 조회",
            description = """
                    PC 가 새로고침·재접속했을 때 화면을 복구하는 조회다. 소켓을 쓰지 않는
                    클라이언트의 폴링 경로이기도 하다. 만료된 세션도 410 대신 EXPIRED
                    상태와 지금까지의 합성 결과를 그대로 반환한다. 세션 소유자가 아니면
                    존재 여부를 감추기 위해 404 다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<SimulationDtos.ArSessionStateResponse> state(
            @PathVariable UUID sessionId
    ) {
        return ApiResponse.of(sessionService.state(SecurityUtils.currentUserSeq(), sessionId));
    }

    @DeleteMapping("/{sessionId}")
    @Operation(
            summary = "AR 세션 종료",
            description = """
                    PC 가 세션을 닫는다. 저장된 sessionToken 식별자를 비우므로 JWT 만료
                    전이라도 폰의 후속 업로드가 즉시 거부된다. 이미 닫힌 세션에 다시
                    요청해도 성공으로 끝나며 이벤트는 한 번만 나간다. 커밋 이후 PC 개인
                    큐로 SESSION_CLOSED 를 전달한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<Boolean> close(@PathVariable UUID sessionId) {
        sessionService.close(SecurityUtils.currentUserSeq(), sessionId);
        return ApiResponse.of(true);
    }
}
