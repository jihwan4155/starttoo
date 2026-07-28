package com.starttoo.domain.artist.controller;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.artist.dto.ArtistDtos.*;
import com.starttoo.domain.artist.service.ArtistService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@Tag(name="Artists", description="타투이스트 인기순 목록·도시/닉네임 복합 검색")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/artists")
public class ArtistController {
    private final ArtistService artistService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary="타투이스트 목록·검색", description="shopCity와 nickname을 각각 또는 함께 사용할 수 있습니다. 인증은 선택입니다.")
    @GetMapping
    public CursorPageResponse<ArtistItem> search(
            @RequestParam(required=false) String shopCity,
            @RequestParam(required=false) String nickname,
            @RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        return artistService.search(authenticationFacade.optionalUserId().orElse(null), shopCity, nickname, cursor, size);
    }

    @Operation(summary="타투이스트 프로필 수정", security=@SecurityRequirement(name="bearerAuth"))
    @PatchMapping("/me")
    public ArtistProfileResponse update(@Valid @RequestBody UpdateArtistRequest request) {
        return artistService.update(authenticationFacade.requireUserId(), request);
    }
}
