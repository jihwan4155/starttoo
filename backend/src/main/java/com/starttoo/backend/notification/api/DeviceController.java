package com.starttoo.backend.notification.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.notification.application.DeviceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/devices")
@RequiredArgsConstructor
@Tag(name = "Devices", description = "푸시 토큰과 로그인 기기 관리")
@SecurityRequirement(name = "bearerAuth")
public class DeviceController {

    private final DeviceService deviceService;

    @PostMapping
    @Operation(
            summary = "푸시 수신 기기 등록·갱신",
            description = """
                    pushToken을 전역 고유키로 upsert한다. 신규 토큰이면 기기 행을 생성하고 기존
                    토큰이면 현재 회원·플랫폼으로 연결을 갱신하면서 활성화하고 마지막 사용 시각을
                    기록한다. 요청의 현재 리프레시 토큰을 해당 deviceSeq에 연결하므로 기기
                    비활성화 시 그 기기의 세션만 폐기할 수 있다. FCM 토큰 회전으로 새 deviceSeq가
                    만들어지면 같은 트랜잭션에서 이전 기기 연결을 비활성화하고 현재 리프레시
                    토큰을 새 기기에 연결한다. 리프레시 토큰의 회원과 JWT 회원이 다르면 거부한다.
                    """
    )
    public ApiResponse<DeviceDtos.DeviceResponse> register(
            @Valid @RequestBody DeviceDtos.RegisterDeviceRequest request
    ) {
        return ApiResponse.of(deviceService.register(SecurityUtils.currentUserSeq(), request));
    }

    @DeleteMapping("/{deviceSeq}")
    @Operation(
            summary = "기기 비활성화",
            description = """
                    현재 회원 소유 기기의 isActive를 false로 변경한다. 해당 deviceSeq에 연결된
                    아직 유효한 모든 리프레시 토큰도 같은 트랜잭션에서 폐기하여 그 기기의 세션을
                    종료한다. 기기 행은 감사와 재등록을 위해 물리 삭제하지 않는다.
                    """
    )
    public ApiResponse<Boolean> deactivate(@PathVariable Long deviceSeq) {
        deviceService.deactivate(SecurityUtils.currentUserSeq(), deviceSeq);
        return ApiResponse.of(true);
    }
}
