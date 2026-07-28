package com.starttoo.domain.simulation.controller;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import com.starttoo.common.exception.FeatureNotImplementedException;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.simulation.dto.SimulationDtos.ArSessionResponse;
import com.starttoo.domain.simulation.dto.SimulationDtos.CompositeImageResponse;
import com.starttoo.domain.simulation.dto.SimulationDtos.ConnectArSessionRequest;
import com.starttoo.domain.simulation.dto.SimulationDtos.ConnectArSessionResponse;
import com.starttoo.domain.simulation.dto.SimulationDtos.CreateArSessionRequest;
import com.starttoo.domain.simulation.dto.SimulationDtos.CreateArSessionResponse;
import com.starttoo.domain.simulation.service.ArSessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.starttoo.domain.simulation.dto.SimulationDtos.CompositeImageRequest;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.ByteArrayOutputStream;

@Tag(name = "Simulation", description = "모바일 웹 카메라 연결과 이미지 합성")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/simulations")
public class SimulationController {

    private final AuthenticationFacade authenticationFacade;
    private final ArSessionService arSessionService;

    @Operation(summary = "AR 연결 세션 생성", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/ar-sessions")
    public ResponseEntity<CreateArSessionResponse> create(
            @Valid @org.springframework.web.bind.annotation.RequestBody CreateArSessionRequest request
    ) {
        var response = arSessionService.create(
                authenticationFacade.requireUserId(),
                request.tattooId(),
                apiBaseUrl()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "모바일 웹 카메라의 AR 세션 연결")
    @PostMapping("/ar-sessions/{sessionId}/connect")
    public ResponseEntity<ConnectArSessionResponse> connect(
            @PathVariable String sessionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody ConnectArSessionRequest request
    ) {
        return ResponseEntity.ok(arSessionService.connect(
                sessionId,
                request.connectToken(),
                apiBaseUrl()
        ));
    }

    @Operation(summary = "AR 연결 세션 상태 조회", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/ar-sessions/{sessionId}")
    public ResponseEntity<ArSessionResponse> get(@PathVariable String sessionId) {
        return ResponseEntity.ok(arSessionService.get(
                authenticationFacade.requireUserId(),
                sessionId
        ));
    }

    @Operation(summary = "모바일 촬영 페이지 QR 이미지")
    @GetMapping(value = "/ar-sessions/{sessionId}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> qr(
            @PathVariable String sessionId,
            @RequestParam String connectToken
    ) throws Exception {
        String captureUrl = arSessionService.mobileCaptureUrl(sessionId, connectToken);
        var matrix = new QRCodeWriter().encode(captureUrl, BarcodeFormat.QR_CODE, 320, 320);
        var output = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", output);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(output.toByteArray());
    }

    @Operation(
            summary = "이미지 합성 요청",
            description = "모델 연결 전까지 501 FEATURE_NOT_IMPLEMENTED를 반환합니다.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    @PostMapping("/ar-sessions/{sessionId}/composites")
    public ResponseEntity<CompositeImageResponse> compose(
            @PathVariable String sessionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody CompositeImageRequest request
    ) {
        arSessionService.validateCompositeAccess(authenticationFacade.requireUserId(), sessionId);
        throw new FeatureNotImplementedException();
    }

    private String apiBaseUrl() {
        return ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
    }
}
