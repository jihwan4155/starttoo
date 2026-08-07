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
            summary = "컬렉션 배치 등록",
            description = """
                    도안 보관함(GET /archive)의 designImageSeq로 기존 타투를 재참조해 배치만 저장한다.
                    같은 도안을 여러 위치에 올릴 수 있다. 보관함에 없는 이미지는 거절한다.
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
                    현재 회원의 소프트 삭제되지 않은 컬렉션을 collectionSeq 내림차순 커서로 조회한다.
                    도안 이미지가 있으면 도안 URL을, 없으면 원본 이미지 URL을 반환한다.
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
                    소유 컬렉션 배치만 소프트 삭제한다. 참조 중인 타투·도안·원본 이미지는 유지하며
                    등록 시 반영된 취향 점수도 행동 이력으로 유지해 역보정하지 않는다.
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
                    응답 항목은 tattooSeq, designImageSeq, designImageUrl, archivedDttm만 제공한다.
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
                    보관 수가 상한(app.collection.archive-max-designs, 기본 20)에 도달한 상태에서
                    새 도안을 담으면 409 ARCHIVE_LIMIT_EXCEEDED로 거절한다. 상한 검사와 생성은
                    회원 단위 advisory lock으로 직렬화해 동시 요청이 상한을 넘기지 못하게 한다.
                    이미 담긴 도안의 반복 요청은 보관 수를 늘리지 않으므로 상한에서도 성공한다.
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
                    현재 회원의 userArchive 관계를 멱등하게 삭제한다. 보관 시 반영된 취향 점수는
                    행동 이력으로 유지하며 역보정하지 않는다. 반복 요청도 enabled=false로 성공한다.
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
