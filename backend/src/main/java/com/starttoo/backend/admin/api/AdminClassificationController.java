package com.starttoo.backend.admin.api;

import com.starttoo.backend.common.api.ApiResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.common.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/admin/classifications")
@RequiredArgsConstructor
@Tag(name = "Admin Classifications", description = "타투 스타일·색상 기준정보 관리")
@SecurityRequirement(name = "bearerAuth")
public class AdminClassificationController {

    private final JdbcTemplate jdbcTemplate;

    @PostMapping("/{type}")
    @Operation(
            summary = "분류 기준정보 등록",
            description = """
                    type에 따라 primary_styles, secondary_styles, rendering_styles 또는 colors에
                    코드와 표시명을 등록한다. 새 항목은 활성 상태로 생성되고 등록·수정 관리자에
                    현재 ADMIN userSeq를 기록한다. 중복 코드나 이름은 충돌로 처리한다.
                    """
    )
    public ApiResponse<Integer> create(
            @PathVariable ClassificationType type,
            @Valid @RequestBody ClassificationRequest request
    ) {
        try {
            Integer adminSeq = SecurityUtils.currentUserSeq();
            Integer seq = jdbcTemplate.queryForObject(
                    "INSERT INTO " + type.table + " ("
                            + type.codeColumn + ", " + type.nameColumn
                            + ", is_active, reg_usr_seq, mod_usr_seq"
                            + ") VALUES (?, ?, TRUE, ?, ?) RETURNING " + type.seqColumn,
                    Integer.class,
                    request.code(),
                    request.name(),
                    adminSeq,
                    adminSeq
            );
            return ApiResponse.of(seq);
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }
    }

    @PatchMapping("/{type}/{seq}/active")
    @Operation(
            summary = "분류 기준정보 활성 상태 변경",
            description = """
                    기준정보 행을 삭제하지 않고 isActive를 변경한다. 비활성 항목은 신규 모델 결과
                    매핑과 공개 분류 목록에서 제외되지만 기존 tattoos의 참조는 유지된다.
                    """
    )
    public ApiResponse<Boolean> active(
            @PathVariable ClassificationType type,
            @PathVariable Integer seq,
            @Valid @RequestBody ActiveRequest request
    ) {
        int changed = jdbcTemplate.update(
                "UPDATE " + type.table
                        + " SET is_active = ?, mod_dttm = CURRENT_TIMESTAMP, mod_usr_seq = ?"
                        + " WHERE " + type.seqColumn + " = ?",
                request.enabled(),
                SecurityUtils.currentUserSeq(),
                seq
        );
        if (changed == 0) {
            throw BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND);
        }
        return ApiResponse.of(request.enabled());
    }

    public record ClassificationRequest(
            @Schema(description = "모델과 서버가 사용하는 고유 코드", example = "BLACKWORK")
            @NotBlank @Size(max = 30) String code,
            @Schema(description = "클라이언트 표시명", example = "블랙워크")
            @NotBlank @Size(max = 50) String name
    ) {
    }

    public record ActiveRequest(
            @Schema(description = "신규 분석과 공개 목록에서 사용할지 여부", example = "true")
            @NotNull Boolean enabled
    ) {
    }

    public enum ClassificationType {
        PRIMARY_STYLE("primary_styles", "primary_style_seq", "style_code", "style_name"),
        SECONDARY_STYLE("secondary_styles", "secondary_style_seq", "style_code", "style_name"),
        RENDERING_STYLE("rendering_styles", "rendering_style_seq", "style_code", "style_name"),
        COLOR("colors", "color_seq", "color_code", "color_name");

        private final String table;
        private final String seqColumn;
        private final String codeColumn;
        private final String nameColumn;

        ClassificationType(
                String table,
                String seqColumn,
                String codeColumn,
                String nameColumn
        ) {
            this.table = table;
            this.seqColumn = seqColumn;
            this.codeColumn = codeColumn;
            this.nameColumn = nameColumn;
        }
    }
}
