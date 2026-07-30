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
import org.springframework.web.bind.annotation.PathVariable;
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
                    """
    )
    public ApiResponse<CursorPageResponse<ArtistDtos.ArtistProfile>> list(
            @RequestParam(required = false) @Size(max = 100) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            @RequestParam(required = false) @Size(max = 100) String city
    ) {
        return ApiResponse.of(artistService.list(cursor, size, city));
    }

    @GetMapping("/{userSeq}")
    @Operation(
            summary = "인증 아티스트 공개 프로필",
            description = """
                    요청한 회원의 삭제되지 않은 아티스트 확장 정보와 현재 회원 정보, 팔로워 수를
                    조합한다. 일반 공개 조회에서는 verificationStatus가 VERIFIED가 아니면
                    존재하지 않는 리소스처럼 처리한다.
                    """
    )
    public ApiResponse<ArtistDtos.ArtistProfile> get(@PathVariable Integer userSeq) {
        return ApiResponse.of(artistService.get(userSeq, true));
    }

    @GetMapping("/me/profile")
    @Operation(
            summary = "내 아티스트 프로필과 심사 상태",
            description = """
                    본인의 프로필은 UNVERIFIED, PENDING, REJECTED 상태도 조회할 수 있다.
                    아직 아티스트 확장 프로필을 작성하지 않았다면 찾을 수 없음으로 응답한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<ArtistDtos.ArtistProfile> me() {
        return ApiResponse.of(artistService.get(SecurityUtils.currentUserSeq(), false));
    }

    @PatchMapping("/me/profile")
    @Operation(
            summary = "아티스트 프로필 작성·수정",
            description = """
                    프로필이 없으면 UNVERIFIED 상태로 생성하고, 있으면 같은 행의 간략한 숍 정보를
                    수정한다. 독립적인 shop 엔티티는 만들지 않는다. 생성 또는 수정과 수정자·수정
                    시각 기록은 하나의 트랜잭션에서 반영된다.
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
            summary = "아티스트 인증 심사 요청",
            description = """
                    먼저 아티스트 프로필이 존재해야 한다. UNVERIFIED 또는 REJECTED 상태만
                    PENDING으로 전환할 수 있으며, 이미 PENDING 또는 VERIFIED이면 상태 충돌로
                    처리한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<ArtistDtos.ArtistProfile> submit(
            @Valid @RequestBody ArtistDtos.VerificationRequest request
    ) {
        return ApiResponse.of(artistService.submit(SecurityUtils.currentUserSeq()));
    }
}
