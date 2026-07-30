package com.starttoo.backend.search.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.common.security.SecurityUtils;
import com.starttoo.backend.search.application.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/v1/search")
@RequiredArgsConstructor
@Tag(name = "Search", description = "계정·아티스트·subject 자동완성 및 게시물 검색")
public class SearchController {

    private final SearchService searchService;

    @GetMapping("/accounts/autocomplete")
    @Operation(
            summary = "회원 닉네임 자동완성",
            description = """
                    한글 완성형을 호환 자모로 분해하고 영문 대소문자·숫자는 보존한 검색키로
                    Redis ZSET 사전을 사전식 범위 조회한다. 사전에는 정규화 닉네임과 userSeq만
                    유지하며, 결과 userSeq를 PostgreSQL에서 다시 조회해 ACTIVE·비삭제·ADMIN 제외
                    조건을 재검증한다. 정확 일치, 짧은 닉네임, 사전순으로 정렬한다.
                    """
    )
    public ApiResponse<List<SearchDtos.AccountResult>> accounts(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,20}$") String q,
            @RequestParam(defaultValue = "10") @Min(1) @Max(20) int size
    ) {
        return ApiResponse.of(searchService.autocompleteAccounts(q, size));
    }

    @GetMapping("/accounts")
    @Operation(
            summary = "회원 닉네임 검색",
            description = """
                    Redis Search가 자모 정규화 닉네임을 exact, prefix, fuzzy 거리 1,
                    fuzzy 거리 2, contains 순서의 독립 단계로 검색한다. 단계 사이에는 점수를
                    비교하지 않고 같은 단계 안에서 Redis relevanceScore를 사용한다. Spring은
                    Redis가 반환한 순서를 다시 계산하지 않으며 PostgreSQL에서 ACTIVE·비삭제·
                    ADMIN 제외 조건과 화면 표시용 nickname·role만 재조회한다. 본 검색은
                    최소 두 글자이며 한 글자 입력은 자동완성 API를 사용한다.
                    """
    )
    public ApiResponse<List<SearchDtos.AccountResult>> searchAccounts(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{2,20}$") String q,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(searchService.searchAccounts(q, size, false));
    }

    @GetMapping("/artists/autocomplete")
    @Operation(
            summary = "인증 아티스트 닉네임 자동완성",
            description = """
                    계정 자동완성과 같은 자모 접두어 ZSET 구조를 사용하지만, users.role=ARTIST이며
                    artists.verificationStatus=VERIFIED인 회원만 인덱싱한다. 조회 후에도
                    PostgreSQL의 현재 계정 상태를 다시 확인한다.
                    """
    )
    public ApiResponse<List<SearchDtos.AccountResult>> artists(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,20}$") String q,
            @RequestParam(defaultValue = "10") @Min(1) @Max(20) int size
    ) {
        return ApiResponse.of(searchService.autocompleteArtists(q, size));
    }

    @GetMapping("/artists")
    @Operation(
            summary = "인증 아티스트 닉네임 검색",
            description = """
                    Redis Search의 아티스트 전용 인덱스에서 exact, prefix, fuzzy 1,
                    fuzzy 2, contains 순으로 후보와 점수를 반환한다. Spring은 순서를 보존하고
                    PostgreSQL에서 ARTIST·VERIFIED·ACTIVE 상태를 다시 확인한다. 팔로워 수와
                    사용자 취향은 검색 결과 정렬에 사용하지 않는다.
                    """
    )
    public ApiResponse<List<SearchDtos.AccountResult>> searchArtists(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{2,20}$") String q,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(searchService.searchAccounts(q, size, true));
    }

    @GetMapping("/subjects/autocomplete")
    @Operation(
            summary = "이미지 subject 자동완성",
            description = """
                    타투 연결 빈도가 높은 subjects와 정답 subject 기준 검색량 상위 항목으로
                    선별한 Redis ZSET 접두어 사전을 조회한다. 한글 자모 입력을 지원하며 정확
                    일치, 짧은 subject, 사전순으로 반환한다. 전체 subjects는 본 검색·오타 보정
                    인덱스에만 사용한다. Redis 유실 시 MinIO의 최신 집계 스냅샷과 이후 JSONL
                    이벤트를 재생해 검색량을 복구한 뒤 사전을 다시 구성할 수 있다.
                    """
    )
    public ApiResponse<List<String>> subjects(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,50}$") String q,
            @RequestParam(defaultValue = "10") @Min(1) @Max(20) int size
    ) {
        return ApiResponse.of(searchService.autocompleteSubjects(q, size));
    }

    @GetMapping("/subjects/corrections")
    @Operation(
            summary = "subject 오타 보정 후보",
            description = """
                    자동완성용 선별 ZSET과 별개로 전체 subjects를 Redis Search HASH에
                    인덱싱한다. Redis가 exact, prefix, fuzzy 거리 1, fuzzy 거리 2, contains
                    단계 순으로 후보를 계산하며 Spring은 재정렬하지 않는다. 응답의 matchType,
                    editDistance와 redisScore로 선택 근거를 확인할 수 있다. contains의
                    editDistance는 편집거리 단계가 아니므로 -1이다.
                    """
    )
    public ApiResponse<List<SearchDtos.SubjectCorrection>> corrections(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{2,50}$") String q,
            @RequestParam(defaultValue = "5") @Min(1) @Max(10) int size
    ) {
        return ApiResponse.of(searchService.correctSubject(q, size));
    }

    @GetMapping("/posts")
    @OptionalAuth
    @Operation(
            summary = "subject 기반 게시물 이미지 검색",
            description = """
                    Redis Search의 전체 subject 인덱스가 exact, prefix, fuzzy 거리 1,
                    fuzzy 거리 2, contains 순으로 후보와 점수를 결정한다. 그 순서를 유지해
                    subjects→tattooSubjects→tattoos→postImages→PUBLISHED posts를 연결하고,
                    로그인 회원에게는 차단 관계와 관심 없음 게시물을 제외한다. 사용자 취향은
                    재정렬에 쓰지 않는다. 최상위 후보 하나를 실제 존재하는 정답 subject로
                    확정해 검색량을 +1 하며 rawQuery와 함께 Redis 대기열에 기록한다. 스케줄러는
                    JSONL 로그와 버전별 subject count 스냅샷을 MinIO에 저장한다.
                    """
    )
    public ApiResponse<List<SearchDtos.PostSearchResult>> posts(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{2,50}$") String q,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication authentication
    ) {
        Integer userSeq = authentication instanceof JwtAuthenticationToken jwt
                ? Integer.valueOf(jwt.getToken().getSubject())
                : null;
        return ApiResponse.of(searchService.searchPosts(userSeq, q, size));
    }

    @PostMapping("/posts/{postSeq}/click")
    @Operation(
            summary = "검색 결과 게시물 클릭 점수 반영",
            description = """
                    프론트엔드가 게시물 검색 결과를 실제로 열었을 때 호출한다. 게시물에 연결된
                    타투 이미지의 주 스타일과 색상에 각각 0.5점을 반영한다. 클릭 이력이나
                    중복 방지 키는 저장하지 않으므로 유효한 호출마다 점수가 누적된다. PUBLISHED
                    게시물 확인과 취향 점수 upsert는 하나의 DB 트랜잭션으로 처리되며, 과도한
                    반복 호출은 공통 상태 변경 rate limit으로 제한한다.
                    """,
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ApiResponse<Boolean> postClick(@PathVariable Long postSeq) {
        return ApiResponse.of(searchService.recordPostSearchClick(
                SecurityUtils.currentUserSeq(),
                postSeq
        ));
    }
}
