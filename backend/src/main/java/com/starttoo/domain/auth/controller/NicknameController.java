package com.starttoo.domain.auth.controller;

import com.starttoo.domain.auth.dto.NicknameAvailabilityResponse;
import com.starttoo.domain.auth.dto.NicknameSuggestionResponse;
import com.starttoo.domain.auth.service.NicknameService;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@com.starttoo.common.openapi.CommonApiResponses
@Tag(name = "Auth", description = "소셜 로그인·가입·JWT·닉네임")
@RequiredArgsConstructor
@RequestMapping("/auth/nicknames")
public class NicknameController {

    private final NicknameService nicknameService;

    @GetMapping("/availability")
    @Operation(summary = "닉네임 중복 확인")
    public ResponseEntity<NicknameAvailabilityResponse> checkAvailability(
            @RequestParam String nickname
    ) {
        return ResponseEntity.ok(nicknameService.checkAvailability(nickname));
    }

    @GetMapping("/suggestion")
    @Operation(summary = "무작위 미중복 닉네임 추천")
    public ResponseEntity<NicknameSuggestionResponse> suggest() {
        return ResponseEntity.ok(nicknameService.suggest());
    }
}
