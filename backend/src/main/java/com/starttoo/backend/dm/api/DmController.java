package com.starttoo.backend.dm.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.dm.application.DmService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/v1/dm")
@RequiredArgsConstructor
@Tag(name = "DM", description = "1대1 채팅방, 메시지, 방별 알림")
@SecurityRequirement(name = "bearerAuth")
public class DmController {

    private final DmService dmService;

    @PostMapping("/rooms")
    @Operation(
            summary = "1대1 채팅방 생성 또는 재활성화",
            description = """
                    자기 자신과의 방 생성은 거부하고 상대 회원 존재 및 양방향 차단 여부를 확인한다.
                    두 userSeq를 작은 값·큰 값 순으로 정규화하여 동일한 두 회원 사이에 방이 하나만
                    존재하게 한다. 기존 방이면 새 행을 만들지 않고 요청자의 참여 상태를 활성화하며,
                    신규 방이면 두 참여자와 기본 알림 enabled=true를 같은 트랜잭션에서 생성한다.
                    실제 채팅방 진입으로 간주하여 요청자가 아직 읽지 않은 상대 메시지와 이 방의
                    NEW_DM 알림도 같은 트랜잭션에서 읽음 처리한다. 상대 프로필 이미지 URL은
                    저장된 MinIO object key로 생성한 단기 Presigned GET URL이다.
                    """
    )
    public ApiResponse<DmDtos.RoomResponse> createRoom(
            @Valid @RequestBody DmDtos.CreateRoomRequest request
    ) {
        return ApiResponse.of(dmService.createRoom(
                SecurityUtils.currentUserSeq(),
                request.partnerSeq()
        ));
    }

    @GetMapping("/rooms")
    @Operation(
            summary = "내 활성 채팅방 목록",
            description = """
                    현재 참여자의 isActive=true인 방만 숨김 기준 이후의 최신 메시지 시각과
                    dmRoomSeq 내림차순의 안정적인 커서로 반환한다. 어느 방향이든 차단 관계가
                    있는 상대의 방은 목록에서 제외하며 차단을 해제하면 기존 히스토리와 함께
                    다시 나타난다. 상대 프로필, 마지막 메시지 미리보기, 방을 나가기 전에 숨긴
                    메시지 이후의 미읽음 수, 현재 방별 알림 설정을 조합한다. 프로필 이미지 URL은
                    저장된 MinIO object key로 생성한 단기 Presigned GET URL이다.
                    """
    )
    public ApiResponse<CursorPageResponse<DmDtos.RoomResponse>> rooms(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size
    ) {
        return ApiResponse.of(dmService.rooms(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @PostMapping("/rooms/{roomSeq}/messages")
    @Operation(
            summary = "DM 메시지 전송",
            description = """
                    참여자 여부와 상대방과의 차단 관계를 검증한다. imageSeq가 있으면 발신자가
                    업로드한 활성 이미지인지 확인하고 텍스트·이미지 조합으로 메시지 타입을 정한다.
                    메시지 저장, 방의 마지막 메시지 시각 갱신, 양 참여자의 방 재활성화를 같은
                    트랜잭션에서 처리한다. 상대방이 방 알림을 켜둔 경우 referenceSeq=roomSeq인
                    NEW_DM 알림도 함께 생성한다. 방 알림을 꺼도 메시지 저장과 미읽음 계산에는
                    영향을 주지 않는다. 커밋 성공 후 `/user/queue/dm-events`로 메시지 이벤트를
                    전송하며, NEW_DM 알림이 생성된 경우 `/user/queue/notifications`와 활성
                    기기의 FCM에도 전송한다. 커밋 후 전송 실패는 저장된 메시지를 롤백하지 않으며
                    클라이언트가 과거 메시지 조회로 복구한다.
                    """
    )
    public ApiResponse<DmDtos.MessageResponse> send(
            @PathVariable Long roomSeq,
            @Valid @RequestBody DmDtos.SendMessageRequest request
    ) {
        return ApiResponse.of(dmService.send(SecurityUtils.currentUserSeq(), roomSeq, request));
    }

    @GetMapping("/rooms/{roomSeq}/messages")
    @Operation(
            summary = "DM 메시지 과거 조회",
            description = """
                    방 참여자만 조회할 수 있고 어느 방향이든 차단 관계가 있으면 403으로 거부한다.
                    dmMessageSeq 내림차순 커서를 사용하며 현재 사용자가
                    마지막으로 나갈 때 기록한 lastHiddenMessageSeq 이하의 과거 메시지는 제외한다.
                    삭제 메시지는 행을 유지하되 본문·이미지 seq·이미지 URL을 null로 반환한다.
                    이미지 URL은 DB에 저장된 MinIO object key로 생성한 단기 Presigned GET URL이다.

                    이 조회는 "지금 이 방을 보고 있다"는 뜻이므로 PATCH /dm/rooms/{roomSeq}/read 와
                    같은 읽음 처리를 함께 수행한다. 상대 메시지의 readDttm과 이 방의 미읽음 NEW_DM
                    알림을 같은 트랜잭션에서 기록하고, 실제로 바뀐 게 있을 때만 상대에게
                    MESSAGES_READ 이벤트를 보낸다. 따라서 방을 열어 둔 채 새 메시지를 받는
                    클라이언트는 읽음 처리를 위해 별도 요청을 보낼 필요가 없다.
                    """
    )
    public ApiResponse<CursorPageResponse<DmDtos.MessageResponse>> messages(
            @PathVariable Long roomSeq,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size
    ) {
        return ApiResponse.of(dmService.messages(
                SecurityUtils.currentUserSeq(),
                roomSeq,
                cursor,
                size
        ));
    }

    @PatchMapping("/rooms/{roomSeq}/read")
    @Operation(
            summary = "상대방 메시지 일괄 읽음",
            description = """
                    방 참여자임과 차단 관계가 없음을 확인한 뒤 본인이 보내지 않았고 아직 읽지 않은 활성 메시지의
                    readDttm을 한 번의 UPDATE로 기록한다. 동시에 현재 회원에게 발송된
                    notificationType=NEW_DM, referenceSeq=roomSeq인 미읽음 알림도 같은
                    readDttm으로 읽음 처리한다. 두 UPDATE는 하나의 트랜잭션이므로 어느 한쪽이
                    실패하면 모두 롤백된다. 커밋 후 상대방의 `/user/queue/dm-events`로
                    MESSAGES_READ 이벤트를 보내며 응답은 실제 변경된 메시지 수다.
                    """
    )
    public ApiResponse<Integer> markRead(@PathVariable Long roomSeq) {
        return ApiResponse.of(dmService.markRead(SecurityUtils.currentUserSeq(), roomSeq));
    }

    @DeleteMapping("/rooms/{roomSeq}")
    @Operation(
            summary = "채팅방 나가기",
            description = """
                    현재 마지막 메시지 seq를 참여자의 lastHiddenMessageSeq로 저장하고 isActive를
                    false로 바꾼다. 메시지와 방 자체는 삭제하지 않는다. 이후 새 메시지가 오면 방은
                    다시 활성화되지만 이전 숨김 기준은 유지되어 나가기 전 메시지는 보이지 않는다.
                    """
    )
    public ApiResponse<Boolean> leave(@PathVariable Long roomSeq) {
        dmService.leave(SecurityUtils.currentUserSeq(), roomSeq);
        return ApiResponse.of(true);
    }

    @PatchMapping("/rooms/{roomSeq}/notification")
    @Operation(
            summary = "채팅방별 알림 설정",
            description = """
                    현재 참여자 행의 notificationEnabled만 변경한다. 알림을 꺼도 메시지는 정상
                    저장되고 미읽음 수에도 포함되며 채팅방 활성 상태에도 영향을 주지 않는다.
                    메시지 전송 시 NEW_DM 알림 행 생성 여부와 푸시 발송 여부를 결정할 때
                    이 값을 사용한다.
                    """
    )
    public ApiResponse<Boolean> notification(
            @PathVariable Long roomSeq,
            @Valid @RequestBody DmDtos.NotificationSettingRequest request
    ) {
        return ApiResponse.of(dmService.notification(
                SecurityUtils.currentUserSeq(),
                roomSeq,
                request.enabled()
        ));
    }

}
