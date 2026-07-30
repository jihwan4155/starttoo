package com.starttoo.backend.admin.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooDesign;
import com.starttoo.backend.tattoo.domain.TattooDesignRepository;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/v1/admin/tattoos")
@RequiredArgsConstructor
@Tag(name = "Admin Tattoos", description = "보관 가능한 타투 도안 관리")
@SecurityRequirement(name = "bearerAuth")
public class AdminTattooController {

    private final TattooRepository tattooRepository;
    private final TattooDesignRepository designRepository;

    @PutMapping("/{tattooSeq}/design")
    @Transactional
    @Operation(
            summary = "타투를 보관 가능 도안으로 등록",
            description = """
                    활성 tattoos 행을 확인한 뒤 tattoo_designs에 등록한다. 이미 존재하면 오류를
                    내지 않고 현재 타투 이미지로 교체한다. 조회·생성 또는 교체는 하나의
                    트랜잭션으로 처리되며, 등록된 타투만 회원 보관함에 담을 수 있다.
                    """
    )
    public ApiResponse<Boolean> registerDesign(@PathVariable Long tattooSeq) {
        Tattoo tattoo = tattooRepository.findByTattooSeqAndDeletedFalse(tattooSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        designRepository.findById(tattooSeq).ifPresentOrElse(
                design -> design.replaceImage(tattoo.getImageSeq()),
                () -> designRepository.save(TattooDesign.builder()
                        .tattooSeq(tattooSeq)
                        .imageSeq(tattoo.getImageSeq())
                        .regDttm(OffsetDateTime.now())
                        .modDttm(OffsetDateTime.now())
                        .deleted(false)
                        .build())
        );
        return ApiResponse.of(true);
    }

    @PatchMapping("/{tattooSeq}/training-used")
    @Transactional
    @Operation(
            summary = "추가 학습 사용 완료 표시",
            description = """
                    활성 타투를 확인하고 isUsedForTraining을 true로 바꾸며 학습 반영 시각을
                    기록한다. 이미 사용 완료된 타투에 대한 반복 호출은 그대로 성공한다.
                    """
    )
    public ApiResponse<Boolean> markUsedForTraining(@PathVariable Long tattooSeq) {
        Tattoo tattoo = tattooRepository.findByTattooSeqAndDeletedFalse(tattooSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        if (!tattoo.isUsedForTraining()) {
            tattoo.markUsedForTraining();
        }
        return ApiResponse.of(true);
    }
}
