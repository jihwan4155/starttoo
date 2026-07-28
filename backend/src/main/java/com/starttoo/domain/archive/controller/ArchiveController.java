package com.starttoo.domain.archive.controller;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.archive.dto.ArchiveDtos.*;
import com.starttoo.domain.archive.service.ArchiveService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@Tag(name="Archive", description="내 타투 도안 보관함")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/archive")
@SecurityRequirement(name="bearerAuth")
public class ArchiveController {
    private final ArchiveService archiveService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary="내 보관함 조회")
    @GetMapping
    public CursorPageResponse<ArchiveItem> list(@RequestParam(required=false) String cursor,
            @RequestParam(defaultValue="20") @Min(1) @Max(50) int size) {
        return archiveService.list(authenticationFacade.requireUserId(), cursor, size);
    }
    @Operation(summary="보관함 저장")
    @PostMapping("/{tattooId}")
    public ArchiveToggleResponse save(@PathVariable Long tattooId) {
        return archiveService.toggle(authenticationFacade.requireUserId(), tattooId, true);
    }
    @Operation(summary="보관함 삭제")
    @DeleteMapping("/{tattooId}")
    public ArchiveToggleResponse delete(@PathVariable Long tattooId) {
        return archiveService.toggle(authenticationFacade.requireUserId(), tattooId, false);
    }
}
