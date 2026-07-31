package com.starttoo.backend.user.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.user.application.RecentSearchService;
import com.starttoo.backend.user.application.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@Validated
@RequestMapping("/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "회원 프로필, 관계, 최근 검색어")
public class UserController {

    private final UserService userService;
    private final RecentSearchService recentSearchService;

    @GetMapping("/me")
    @Operation(
            summary = "내 계정·프로필 조회",
            description = """
                    JWT subject의 회원을 조회하여 휴대폰 인증 정보, 역할과 계정 상태를 반환한다.
                    프로필 이미지는 단기 Presigned GET URL이며 ARTIST 역할이고 확장 행이 있으면
                    artistProfile을 포함한다. 정지·강퇴·탈퇴 상태는 인증 필터에서 먼저 차단한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.MyProfile> me() {
        return ApiResponse.of(userService.me(SecurityUtils.currentUserSeq()));
    }

    @PatchMapping("/me")
    @Operation(
            summary = "내 프로필 수정",
            description = """
                    탈퇴하지 않은 회원의 닉네임 중복을 확인하고 닉네임·생년월일·성별과 수정
                    정보를 같은 트랜잭션에서 갱신한다. 탈퇴 회원 닉네임은 재사용할 수 있으며
                    프로필 이미지는 별도 API에서 교체한다. 커밋 후 Redis 검색 인덱스를 갱신한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.MyProfile> update(
            @Valid @RequestBody UserDtos.UpdateProfileRequest request
    ) {
        return ApiResponse.of(userService.update(SecurityUtils.currentUserSeq(), request));
    }

    @PatchMapping("/me/profile-image")
    @Operation(
            summary = "내 프로필 이미지 교체",
            description = """
                    imageSeq가 현재 회원이 PROFILE 목적으로 업로드한 활성 이미지인지 검증한 뒤
                    users.profileImageSeq만 교체한다. 기존 images 행과 MinIO 객체는 즉시 삭제하지
                    않으며 응답의 profileImageUrl은 object key로 생성한 단기 Presigned GET URL이다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.MyProfile> replaceProfileImage(
            @Valid @RequestBody UserDtos.ProfileImageRequest request
    ) {
        return ApiResponse.of(userService.replaceProfileImage(
                SecurityUtils.currentUserSeq(),
                request.imageSeq()
        ));
    }

    @DeleteMapping("/me")
    @Operation(
            summary = "회원 탈퇴",
            description = """
                    users 행을 즉시 삭제하지 않는다. accountStatus를 WITHDRAWN으로 변경하고
                    USER_REQUEST 상태 이력을 추가하며, 아직 유효한 모든 리프레시 토큰 폐기와
                    모든 푸시 기기 비활성화를 같은 트랜잭션에서 수행한다. 커밋 후 계정·아티스트
                    검색 인덱스에서 제거하며 이미 탈퇴한 계정의 반복 요청은 상태 충돌이다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<Boolean> withdraw() {
        userService.withdraw(SecurityUtils.currentUserSeq());
        return ApiResponse.of(true);
    }

    @GetMapping("/{userSeq}")
    @OptionalAuth
    @Operation(
            summary = "공개 회원 프로필",
            description = """
                    ADMIN과 비활성 계정은 공개하지 않는다. 로그인한 조회자와 대상 사이에 어느
                    방향으로든 차단 관계가 있으면 존재하지 않는 회원처럼 응답한다. 팔로워·팔로잉
                    수와 조회자의 팔로우 여부를 조합하며 비로그인 조회자의 followedByMe는 false다.
                    프로필 이미지는 단기 URL이고 VERIFIED 아티스트 확장만 포함한다.
                    """
    )
    public ApiResponse<UserDtos.PublicProfile> profile(
            @PathVariable Integer userSeq,
            Authentication authentication
    ) {
        Integer viewerSeq = authentication instanceof JwtAuthenticationToken jwt
                ? Integer.valueOf(jwt.getToken().getSubject())
                : null;
        return ApiResponse.of(userService.profile(userSeq, viewerSeq));
    }

    @PutMapping("/{userSeq}/follow")
    @Operation(
            summary = "회원 팔로우",
            description = """
                    ON CONFLICT DO NOTHING으로 팔로우 관계를 멱등하게 생성하고 새로 생성된
                    경우에만 상대방 알림을 저장한다. 자기 자신, ADMIN, 비활성 회원 및 상호
                    차단 관계는 허용하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.RelationState> follow(@PathVariable Integer userSeq) {
        return ApiResponse.of(new UserDtos.RelationState(
                userService.setFollow(
                        SecurityUtils.currentUserSeq(),
                        userSeq,
                        true
                )
        ));
    }

    @DeleteMapping("/{userSeq}/follow")
    @Operation(
            summary = "회원 팔로우 해제",
            description = """
                    현재 회원이 만든 팔로우 관계를 멱등하게 삭제한다. 관계가 이미 없어도 성공하며
                    자기 자신, ADMIN 및 비활성 회원은 관계 대상으로 허용하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.RelationState> unfollow(@PathVariable Integer userSeq) {
        return ApiResponse.of(new UserDtos.RelationState(
                userService.setFollow(
                        SecurityUtils.currentUserSeq(),
                        userSeq,
                        false
                )
        ));
    }

    @PutMapping("/{userSeq}/block")
    @Operation(
            summary = "회원 차단",
            description = """
                    차단 행을 멱등하게 생성하고 양방향 팔로우 관계를 같은 트랜잭션에서 제거한다.
                    반복 요청은 추가 관계 변경 없이 성공한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.RelationState> block(@PathVariable Integer userSeq) {
        return ApiResponse.of(new UserDtos.RelationState(
                userService.setBlock(
                        SecurityUtils.currentUserSeq(),
                        userSeq,
                        true
                )
        ));
    }

    @DeleteMapping("/{userSeq}/block")
    @Operation(
            summary = "회원 차단 해제",
            description = """
                    현재 회원이 만든 차단 관계를 멱등하게 삭제한다. 차단 해제는 이전 팔로우 관계를
                    자동 복구하지 않으며 관계가 이미 없어도 성공한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.RelationState> unblock(@PathVariable Integer userSeq) {
        return ApiResponse.of(new UserDtos.RelationState(
                userService.setBlock(
                        SecurityUtils.currentUserSeq(),
                        userSeq,
                        false
                )
        ));
    }

    @GetMapping("/{userSeq}/followers")
    @OptionalAuth
    @Operation(
            summary = "회원 팔로워 목록",
            description = """
                    대상 공개 가능 여부와 조회자 차단 관계를 확인한 뒤 관계 생성 시각 내림차순
                    커서로 팔로워를 반환한다. 비활성·삭제·ADMIN 회원은 제외하고 프로필 이미지는
                    object key로 생성한 단기 Presigned GET URL을 제공한다.
                    """
    )
    public ApiResponse<CursorPageResponse<UserDtos.RelationUser>> followers(
            @PathVariable Integer userSeq,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication authentication
    ) {
        return ApiResponse.of(userService.followers(
                userSeq,
                optionalUserSeq(authentication),
                cursor,
                size
        ));
    }

    @GetMapping("/{userSeq}/following")
    @OptionalAuth
    @Operation(
            summary = "회원 팔로잉 목록",
            description = """
                    대상 공개 가능 여부와 조회자 차단 관계를 확인한 뒤 관계 생성 시각 내림차순
                    커서로 팔로잉 회원을 반환한다. 비활성·삭제·ADMIN 회원은 제외하며 로그인한
                    조회자의 followedByMe를 현재 PostgreSQL 관계로 계산한다.
                    """
    )
    public ApiResponse<CursorPageResponse<UserDtos.RelationUser>> following(
            @PathVariable Integer userSeq,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication authentication
    ) {
        return ApiResponse.of(userService.following(
                userSeq,
                optionalUserSeq(authentication),
                cursor,
                size
        ));
    }

    @GetMapping("/me/blocks")
    @Operation(
            summary = "내 차단 회원 목록",
            description = """
                    현재 회원이 차단한 관계를 생성 시각 내림차순 커서로 반환한다. 대상 중
                    비활성·삭제·ADMIN 회원은 제외하고 실제 pushToken 등 보안 정보는 포함하지
                    않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<CursorPageResponse<UserDtos.RelationUser>> blocks(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(userService.blocks(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @GetMapping("/me/recent-searches")
    @Operation(
            summary = "최근 검색어 조회",
            description = """
                    Redis 목록을 우선 조회하고 캐시가 비어 있으면 users.recentSearchTerms 배열을
                    한 번 읽어 복원한다. Redis 장애 시에도 PostgreSQL 배열을 폴백으로 반환하므로
                    DB 반영 주기만큼 이전 값일 수 있다. 목록이 비어 있으면 null이 아닌 빈 배열을
                    반환한다. 최대 10개이며 최신 검색어가 앞에 온다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<List<String>> recentSearches() {
        return ApiResponse.of(recentSearchService.get(SecurityUtils.currentUserSeq()));
    }

    @PatchMapping("/me/recent-searches")
    @Operation(
            summary = "최근 검색어 추가·제거",
            description = """
                    ADD는 검색어 앞뒤 공백을 제거하고 기존 동일 항목을 지운 뒤 맨 앞에 추가한다.
                    REMOVE는 완전히 일치하는 한 항목을 제거한다. 최대 10개로 유지하고 dirty 사용자
                    집합에 기록하며 DB 배열은 스케줄러가 지연 반영한다. Redis 장애 중에는 503을
                    반환하고 전체 삭제 operation은 제공하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<List<String>> updateRecentSearches(
            @Valid @RequestBody UserDtos.RecentSearchUpdateRequest request
    ) {
        Integer userSeq = SecurityUtils.currentUserSeq();
        return ApiResponse.of(switch (request.operation()) {
            case ADD -> recentSearchService.add(userSeq, request.term());
            case REMOVE -> recentSearchService.remove(userSeq, request.term());
        });
    }

    private Integer optionalUserSeq(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return Integer.valueOf(jwt.getToken().getSubject());
        }
        return null;
    }
}
