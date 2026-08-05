package com.starttoo.backend.artist.api;

import com.starttoo.backend.artist.application.ArtistService;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/v1/artists")
@RequiredArgsConstructor
@Tag(name = "Artists", description = "아티스트 프로필과 인증")
public class ArtistController {

    private final ArtistService artistService;

    @GetMapping
    @Operation(
            summary = "인증 아티스트 목록",
            description = """
                    VERIFIED 아티스트이면서 ACTIVE 회원인 프로필만 조회한다. 팔로워 수 내림차순,
                    userSeq 내림차순의 복합 커서를 사용하여 동률에서도 순서가 고정된다.
                    city가 있으면 저장된 shopCity와 정확히 일치하는 항목만 반환한다.
                    각 아티스트에는 최신 PUBLISHED 게시물 최대 6개를 postSeq 내림차순으로
                    포함한다. 게시물 항목은 postSeq, 첫 이미지의 단기 Presigned GET URL,
                    likeCount만 제공한다.
                    """
    )
    public ApiResponse<CursorPageResponse<ArtistDtos.ArtistListItem>> list(
            @RequestParam(required = false) @Size(max = 100) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            @RequestParam(required = false) @Size(max = 100) String city
    ) {
        return ApiResponse.of(artistService.list(cursor, size, city));
    }

    @PatchMapping("/me/profile")
    @Operation(
            summary = "아티스트 프로필 작성·수정",
            description = """
                    users.role=ARTIST인 회원만 가입 시 생성된 artists 행의 숍 정보를 수정할 수
                    있다. USER이거나 artists 행이 없으면 거부한다. verificationStatus와 role은
                    변경하지 않으며 독립적인 shop 엔티티도 만들지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<ArtistDtos.ArtistProfile> update(
            @Valid @RequestBody ArtistDtos.UpdateArtistRequest request
    ) {
        return ApiResponse.of(artistService.update(SecurityUtils.currentUserSeq(), request));
    }

    @PostMapping("/me/verification")
    @Operation(
            summary = "아티스트 인증 처리",
            description = """
                    users.role=ARTIST이면서 아직 VERIFIED가 아닌 회원이 자신의 인증 상태를
                    VERIFIED로 변경한다. 원래는 관리자 승인 흐름이 필요하지만 현재는 승인
                    단계를 생략하고 호출 즉시 인증이 완료된다. USER이면 403, artists 행이
                    없으면 404, 이미 VERIFIED이면 409를 반환한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<ArtistDtos.ArtistProfile> verify() {
        return ApiResponse.of(artistService.verify(SecurityUtils.currentUserSeq()));
    }

}
