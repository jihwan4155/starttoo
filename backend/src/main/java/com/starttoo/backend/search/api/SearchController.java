package com.starttoo.backend.search.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.search.application.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
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
    public ApiResponse<List<SearchDtos.SubjectResult>> subjects(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{1,50}$") String q,
            @RequestParam(defaultValue = "10") @Min(1) @Max(20) int size
    ) {
        return ApiResponse.of(searchService.autocompleteSubjects(q, size));
    }

    @GetMapping("/posts")
    @OptionalAuth
    @Operation(
            summary = "subject 기반 게시물 이미지 검색",
            description = """
                    전체 Subject Redis Search 인덱스에서 exact, prefix, fuzzy 거리 1,
                    fuzzy 거리 2, contains 순으로 최상위 정답 Subject를 결정한다. 그 Subject와
                    연결된 PUBLISHED 게시물을 postSeq 내림차순 커서로 조회하고, 로그인 회원에게는
                    차단 관계와 관심 없음 게시물을 제외한다. 공통 Post 응답의 모든 이미지 URL은
                    MinIO object key로 생성한 단기 Presigned GET URL이다. 보정된 실제 Subject의
                    검색량을 +1 하고 raw query와 함께 Redis 대기열에 기록한다.
                    """
    )
    public ApiResponse<SearchDtos.PostSearchResponse> posts(
            @RequestParam @Pattern(regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{2,50}$") String q,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication authentication
    ) {
        Integer userSeq = authentication instanceof JwtAuthenticationToken jwt
                ? Integer.valueOf(jwt.getToken().getSubject())
                : null;
        return ApiResponse.of(searchService.searchPosts(userSeq, q, cursor, size));
    }
}
