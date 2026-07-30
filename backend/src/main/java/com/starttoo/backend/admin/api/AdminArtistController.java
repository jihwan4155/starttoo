package com.starttoo.backend.admin.api;

import com.starttoo.backend.artist.api.ArtistDtos;
import com.starttoo.backend.artist.application.ArtistService;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/admin/artists")
@RequiredArgsConstructor
@Tag(name = "Admin Artists", description = "관리자 아티스트 인증 심사")
@SecurityRequirement(name = "bearerAuth")
public class AdminArtistController {

    private final ArtistService artistService;

    @PatchMapping("/{userSeq}/verification")
    @Operation(
            summary = "아티스트 인증 승인·거절",
            description = """
                    PENDING 상태의 심사 요청만 VERIFIED 또는 REJECTED로 처리한다. REJECTED에는
                    거절 사유가 필수다. VERIFIED 승인 시 artists의 심사 결과와 users.role=ARTIST
                    변경을 같은 트랜잭션에 포함하여 역할과 인증 상태가 어긋나지 않게 한다.
                    커밋 후에만 인증 아티스트 검색·자동완성 인덱스에 추가한다.
                    """
    )
    public ApiResponse<ArtistDtos.ArtistProfile> decide(
            @PathVariable Integer userSeq,
            @Valid @RequestBody ArtistDtos.VerificationDecision request
    ) {
        return ApiResponse.of(artistService.decide(
                userSeq,
                SecurityUtils.currentUserSeq(),
                request
        ));
    }
}
