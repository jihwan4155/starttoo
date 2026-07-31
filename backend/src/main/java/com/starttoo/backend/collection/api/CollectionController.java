package com.starttoo.backend.collection.api;

import com.starttoo.backend.collection.application.CollectionService;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.config.OptionalAuth;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
@Tag(name = "Collections & Archive", description = "신체 배치 컬렉션과 도안 보관함")
@SecurityRequirement(name = "bearerAuth")
public class CollectionController {

    private final CollectionService collectionService;

    @PostMapping("/collections")
    @Operation(
            summary = "컬렉션 타투와 배치 정보 등록",
            description = """
                    회원 소유 이미지의 object key로 단기 Presigned GET URL을 생성하고 쓰기
                    트랜잭션 밖에서 타투 판별과 분석을 수행한다. AI 연동이 비활성화된 환경에서는
                    같은 경계에서 명시적 분석 Stub을 사용한다.
                    준비가 성공한 뒤 tattoos, subjects, tattooCollections와 주 스타일·색상 취향
                    점수를 하나의 DB 트랜잭션으로 처리하며 중간 실패 시 모두 롤백한다.
                    """
    )
    public ApiResponse<CollectionDtos.CollectionResponse> create(
            @Valid @RequestBody CollectionDtos.CreateCollectionRequest request
    ) {
        return ApiResponse.of(collectionService.create(
                SecurityUtils.currentUserSeq(),
                request
        ));
    }

    @GetMapping("/collections")
    @Operation(
            summary = "내 타투 컬렉션 목록",
            description = """
                    현재 회원의 소프트 삭제되지 않은 USER_COLLECTION 컬렉션을 collectionSeq
                    내림차순 커서로 조회한다. 원본 imageSeq와 object key로 생성한 단기 Presigned
                    GET URL, 신체 배치 정보를 함께 반환한다.
                    """
    )
    public ApiResponse<CursorPageResponse<CollectionDtos.CollectionResponse>> list(
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(collectionService.list(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @GetMapping("/users/{userSeq}/collections")
    @OptionalAuth
    @Operation(
            summary = "다른 회원 타투 컬렉션 목록",
            description = """
                    대상이 ACTIVE 비삭제 일반·아티스트 회원이고 조회자와 양방향 차단 관계가 없을
                    때 활성 컬렉션을 collectionSeq 내림차순 커서로 공개한다. 별도 공개 범위 칼럼이
                    없으므로 현재는 모든 활성 컬렉션을 반환하며 이미지 URL은 단기 Presigned GET
                    URL이다.
                    """
    )
    public ApiResponse<CursorPageResponse<CollectionDtos.CollectionResponse>> byUser(
            @PathVariable Integer userSeq,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size,
            Authentication authentication
    ) {
        return ApiResponse.of(collectionService.byUser(
                userSeq,
                optionalUserSeq(authentication),
                cursor,
                size
        ));
    }

    @DeleteMapping("/collections/{collectionSeq}")
    @Operation(
            summary = "컬렉션 삭제",
            description = """
                    소유 컬렉션과 이 등록 과정에서 생성된 tattoos 행을 같은 트랜잭션에서 소프트
                    삭제한다. 이미지 원본 images 행은 삭제하지 않는다.
                    """
    )
    public ApiResponse<Boolean> delete(@PathVariable Long collectionSeq) {
        collectionService.delete(SecurityUtils.currentUserSeq(), collectionSeq);
        return ApiResponse.of(true);
    }

    @GetMapping("/archive")
    @Operation(
            summary = "내 타투 도안 보관함",
            description = """
                    현재 회원의 보관함을 보관 시각과 tattooSeq 내림차순 커서로 조회한다.
                    활성 tattooDesigns, tattoos, images만 반환하며 도안 이미지 URL은 DB에
                    저장된 MinIO objectKey로 단기 Presigned GET URL을 생성해 제공한다.
                    subjects가 없으면 빈 배열을 반환한다.
                    """
    )
    public ApiResponse<CursorPageResponse<CollectionDtos.TattooDesignItem>> archive(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String cursor,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return ApiResponse.of(collectionService.archive(
                SecurityUtils.currentUserSeq(),
                cursor,
                size
        ));
    }

    @PutMapping("/archive/{tattooSeq}")
    @Operation(
            summary = "타투 도안 보관",
            description = """
                    활성 tattoos와 tattooDesigns 존재를 확인하고 userArchive를 멱등하게 생성한다.
                    실제로 새 보관 관계가 생성된 경우에만 같은 트랜잭션에서 주 스타일·색상 취향
                    점수를 가산하며, 반복 요청은 점수를 중복 변경하지 않고 성공한다.
                    """
    )
    public ApiResponse<CollectionDtos.ArchiveStateResponse> archive(@PathVariable Long tattooSeq) {
        return ApiResponse.of(new CollectionDtos.ArchiveStateResponse(
                collectionService.setArchive(
                        SecurityUtils.currentUserSeq(),
                        tattooSeq,
                        true
                )
        ));
    }

    @DeleteMapping("/archive/{tattooSeq}")
    @Operation(
            summary = "타투 도안 보관 해제",
            description = """
                    현재 회원의 userArchive 관계를 멱등하게 삭제한다. 실제로 관계가 삭제된 경우에만
                    같은 트랜잭션에서 주 스타일·색상 취향 점수를 역산하며, 반복 요청은 점수를
                    중복 변경하지 않고 성공한다.
                    """
    )
    public ApiResponse<CollectionDtos.ArchiveStateResponse> removeArchive(@PathVariable Long tattooSeq) {
        return ApiResponse.of(new CollectionDtos.ArchiveStateResponse(
                collectionService.setArchive(
                        SecurityUtils.currentUserSeq(),
                        tattooSeq,
                        false
                )
        ));
    }

    private Integer optionalUserSeq(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return Integer.valueOf(jwt.getToken().getSubject());
        }
        return null;
    }
}
