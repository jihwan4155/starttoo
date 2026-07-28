package com.starttoo.domain.dm.controller;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.dm.dto.DmDtos.*;
import com.starttoo.domain.dm.service.DmService;
import com.starttoo.domain.notification.dto.NotificationDtos.DmRoomMuteResponse;
import com.starttoo.domain.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@Tag(name="DM", description="1:1 채팅방·메시지 REST API")
@SecurityRequirement(name="bearerAuth")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/dm")
public class DmController {
    private final DmService dmService;
    private final NotificationService notificationService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary="채팅방 목록")
    @GetMapping("/rooms")
    public CursorPageResponse<Room> rooms(@RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        return dmService.rooms(authenticationFacade.requireUserId(), cursor, size);
    }
    @Operation(summary="채팅방 생성·진입")
    @PostMapping("/rooms")
    public ResponseEntity<Room> enter(@Valid @RequestBody CreateRoomRequest request) {
        var result = dmService.enter(authenticationFacade.requireUserId(), request.otherUserId());
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.room());
    }
    @Operation(summary="채팅방 나가기")
    @DeleteMapping("/rooms/{dmRoomId}")
    public ResponseEntity<Void> leave(@PathVariable Long dmRoomId) {
        dmService.leave(authenticationFacade.requireUserId(), dmRoomId);
        return ResponseEntity.noContent().build();
    }
    @Operation(summary="DM 방 알림 끄기 상태 조회",
            description="현재 회원의 방별 알림 끄기 상태를 조회합니다. 방을 나갔다가 다시 활성화해도 설정은 유지됩니다.")
    @GetMapping("/rooms/{dmRoomId}/notification-mute")
    public DmRoomMuteResponse notificationMute(@PathVariable Long dmRoomId) {
        return notificationService.roomMute(authenticationFacade.requireUserId(), dmRoomId);
    }
    @Operation(summary="DM 방 알림 끄기",
            description="설정 행을 생성하고 해당 방에 쌓인 기존 미확인 NEW_DM 알림을 모두 읽음 처리합니다. 이후 메시지는 저장되지만 알림 행과 푸시는 생성하지 않습니다.")
    @PostMapping("/rooms/{dmRoomId}/notification-mute")
    public DmRoomMuteResponse muteNotifications(@PathVariable Long dmRoomId) {
        return notificationService.muteRoom(authenticationFacade.requireUserId(), dmRoomId);
    }
    @Operation(summary="DM 방 알림 다시 받기",
            description="방별 알림 끄기 행을 삭제합니다. 이후 새 메시지부터 알림 행과 푸시 발송 대상이 됩니다.")
    @DeleteMapping("/rooms/{dmRoomId}/notification-mute")
    public DmRoomMuteResponse unmuteNotifications(@PathVariable Long dmRoomId) {
        return notificationService.unmuteRoom(authenticationFacade.requireUserId(), dmRoomId);
    }
    @Operation(summary="메시지 목록")
    @GetMapping("/rooms/{dmRoomId}/messages")
    public CursorPageResponse<Message> messages(@PathVariable Long dmRoomId,
            @RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="30") @Min(1) @Max(50) int size) {
        return dmService.messages(authenticationFacade.requireUserId(), dmRoomId, cursor, size);
    }
    @Operation(summary="메시지 전송", description="이미지는 업로드 완료 objectKey로 전달합니다.")
    @PostMapping("/rooms/{dmRoomId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public Message send(@PathVariable Long dmRoomId, @Valid @RequestBody SendMessageRequest request) {
        return dmService.send(authenticationFacade.requireUserId(), dmRoomId, request);
    }
    @Operation(summary="메시지 읽음 처리")
    @PatchMapping("/rooms/{dmRoomId}/read")
    public ResponseEntity<Void> read(@PathVariable Long dmRoomId, @Valid @RequestBody ReadRequest request) {
        dmService.read(authenticationFacade.requireUserId(), dmRoomId, request.lastReadMessageId());
        return ResponseEntity.noContent().build();
    }
}
