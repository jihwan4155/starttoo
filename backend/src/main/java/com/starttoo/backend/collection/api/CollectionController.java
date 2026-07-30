package com.starttoo.backend.collection.api;

import com.starttoo.backend.collection.application.CollectionService;
import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
                    회원 소유 이미지를 확인한다. 현재 모델 연동 전 단계이므로 타투 여부
                    판별·분석 호출은 비활성화하고 고정 분류값으로 tattoos와 subject를 만든다.
                    표준 bodyView 위 배치 좌표·배율·회전·뒤집기와 주 스타일·색상 취향 점수
                    가산까지 하나의 DB 트랜잭션으로 처리하여 어느 저장 단계라도 실패하면 모두
                    롤백한다. 모델 연결 후에는 타투 판별을 통과한 이미지만 등록을 허용한다.
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
                    현재 회원의 소프트 삭제되지 않은 컬렉션을 최신순으로 조회한다. 각 컬렉션의
                    tattooSeq와 원본 imageSeq, 신체 배치 정보를 함께 반환한다.
                    """
    )
    public ApiResponse<List<CollectionDtos.CollectionResponse>> list() {
        return ApiResponse.of(collectionService.list(SecurityUtils.currentUserSeq()));
    }

    @PatchMapping("/collections/{collectionSeq}")
    @Operation(
            summary = "컬렉션 배치 수정",
            description = """
                    소유자만 bodyView, 0~1 정규화 좌표, 양수 배율, -180~180도 회전과 뒤집기
                    상태를 수정할 수 있다. 타투 분석 결과와 원본 이미지는 변경하지 않는다.
                    """
    )
    public ApiResponse<CollectionDtos.CollectionResponse> update(
            @PathVariable Long collectionSeq,
            @Valid @RequestBody CollectionDtos.UpdatePlacementRequest request
    ) {
        return ApiResponse.of(collectionService.update(
                SecurityUtils.currentUserSeq(),
                collectionSeq,
                request
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
                    userArchive에 저장된 tattooSeq를 저장 시각 역순으로 반환한다. 보관함은
                    tattooDesigns에 관리자가 등록한 도안만 포함할 수 있으며 컬렉션과 별개다.
                    """
    )
    public ApiResponse<List<Long>> archive() {
        return ApiResponse.of(collectionService.archive(SecurityUtils.currentUserSeq()));
    }

    @PutMapping("/archive/{tattooSeq}")
    @Operation(
            summary = "타투 도안 보관 상태 설정",
            description = """
                    enabled=true이면 활성 tattooDesigns에 존재하는지 확인하면서 보관 관계를
                    멱등하게 생성한다. 대상이 보관 가능한 도안이 아니면 상태 충돌이다.
                    enabled=false이면 회원의 보관 관계만 삭제하며 원본 타투는 변경하지 않는다.
                    """
    )
    public ApiResponse<Boolean> archive(
            @PathVariable Long tattooSeq,
            @RequestParam(defaultValue = "true") boolean enabled
    ) {
        return ApiResponse.of(collectionService.setArchive(
                SecurityUtils.currentUserSeq(),
                tattooSeq,
                enabled
        ));
    }
}
