package com.starttoo.backend.user.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.user.application.RecentSearchService;
import com.starttoo.backend.user.application.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
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
                    JWT subject의 회원을 조회하여 휴대폰 인증 정보, 역할, 계정 상태와 DB에 마지막으로
                    반영된 최근 검색어 배열을 반환한다. 인증 필터에서 정지·강퇴·탈퇴 상태가 먼저
                    차단된다.
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
                    닉네임 중복을 확인하고 profileImageSeq가 있으면 본인이 업로드한 활성 이미지인지
                    검증한다. 프로필 값과 modDttm·modUsrSeq를 같은 트랜잭션에서 갱신한다.
                    커밋 후 닉네임 검색 인덱스의 기존 값을 제거하고 새 값을 증분 반영한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.MyProfile> update(
            @Valid @RequestBody UserDtos.UpdateProfileRequest request
    ) {
        return ApiResponse.of(userService.update(SecurityUtils.currentUserSeq(), request));
    }

    @DeleteMapping("/me")
    @Operation(
            summary = "회원 탈퇴",
            description = """
                    users 행을 즉시 삭제하지 않는다. accountStatus를 WITHDRAWN으로 변경하고
                    USER_REQUEST 상태 이력을 추가하며, 아직 유효한 모든 리프레시 토큰을 같은
                    트랜잭션에서 폐기한다. 커밋 후 계정·아티스트 검색 인덱스에서 제거한다.
                    이미 탈퇴한 계정의 반복 요청은 상태 충돌이다.
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
                    수와 조회자의 팔로우 여부를 조합하며, 비로그인 조회자의 followedByMe는 false다.
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
            summary = "팔로우 상태 설정",
            description = """
                    enabled=true는 ON CONFLICT DO NOTHING으로 중복 생성을 막고 새로 생성된 경우에만
                    상대방 알림을 저장한다. enabled=false는 관계 행을 삭제한다. 자기 자신, ADMIN,
                    비활성 회원 및 상호 차단 관계는 허용하지 않는다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.RelationState> follow(
            @PathVariable Integer userSeq,
            @RequestParam(defaultValue = "true") boolean enabled
    ) {
        return ApiResponse.of(new UserDtos.RelationState(
                userService.setFollow(SecurityUtils.currentUserSeq(), userSeq, enabled)
        ));
    }

    @PutMapping("/{userSeq}/block")
    @Operation(
            summary = "차단 상태 설정",
            description = """
                    enabled=true이면 차단 행을 멱등하게 생성하고 양방향 팔로우 관계를 같은
                    트랜잭션에서 제거한다. enabled=false이면 요청자가 만든 차단 행만 삭제한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<UserDtos.RelationState> block(
            @PathVariable Integer userSeq,
            @RequestParam(defaultValue = "true") boolean enabled
    ) {
        return ApiResponse.of(new UserDtos.RelationState(
                userService.setBlock(SecurityUtils.currentUserSeq(), userSeq, enabled)
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

    @PostMapping("/me/recent-searches")
    @Operation(
            summary = "최근 검색어 추가",
            description = """
                    검색어의 앞뒤 공백을 제거하고 Redis 목록의 기존 동일 항목을 제거한 뒤 맨 앞에
                    추가한다. 최대 10개로 자르고 dirty 사용자 집합에 기록한다. DB 배열은 요청마다
                    갱신하지 않고 스케줄러가 일정 주기로 일괄 반영한다. Redis 장애 중에는 변경을
                    성공으로 오인하지 않도록 503을 반환한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<List<String>> addRecentSearch(
            @Valid @RequestBody UserDtos.RecentSearchRequest request
    ) {
        return ApiResponse.of(recentSearchService.add(
                SecurityUtils.currentUserSeq(),
                request.term()
        ));
    }

    @DeleteMapping("/me/recent-searches")
    @Operation(
            summary = "최근 검색어 한 건 제거",
            description = """
                    Redis 목록에서 완전히 일치하는 검색어를 제거하고 write-behind 대상 사용자로
                    표시한다. 변경된 목록은 즉시 반환하지만 PostgreSQL 반영은 지연될 수 있다.
                    Redis 장애 중에는 변경을 성공으로 오인하지 않도록 503을 반환한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<List<String>> removeRecentSearch(@RequestParam String term) {
        return ApiResponse.of(recentSearchService.remove(SecurityUtils.currentUserSeq(), term));
    }

}
