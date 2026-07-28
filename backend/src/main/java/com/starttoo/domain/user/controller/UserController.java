package com.starttoo.domain.user.controller;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.config.security.AuthenticationFacade;
import com.starttoo.domain.user.dto.UserDtos.*;
import com.starttoo.domain.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@Tag(name = "Users", description = "회원 프로필·소셜 관계·설정·컬렉션")
@RestController
@com.starttoo.common.openapi.CommonApiResponses
@RequiredArgsConstructor
@RequestMapping("/users")
public class UserController {

    private final UserService userService;
    private final AuthenticationFacade authenticationFacade;

    @Operation(summary = "역할 기반 내 정보 조회", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/me")
    public MeResponse me() { return userService.me(authenticationFacade.requireUserId()); }

    @Operation(summary = "내 정보 수정", description = "닉네임·생년월일·성별을 수정합니다. 프로필 이미지는 전용 API를 사용합니다.",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/me")
    public UpdateMeResponse updateMe(@Valid @RequestBody UpdateMeRequest request) {
        return userService.updateMe(authenticationFacade.requireUserId(), request);
    }

    @Operation(summary = "프로필 이미지 등록·교체",
            description = "업로드 완료된 objectKey를 검증한 후 users.profile_image_key에 저장합니다. images 테이블에는 등록하지 않습니다.",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PutMapping("/me/profile-image")
    public ProfileImageResponse updateProfileImage(@Valid @RequestBody ProfileImageRequest request) {
        return userService.updateProfileImage(authenticationFacade.requireUserId(), request);
    }

    @Operation(summary = "프로필 이미지 삭제",
            description = "프로필 이미지를 환경설정의 공용 기본 이미지 objectKey로 되돌립니다. images 테이블에는 등록하지 않습니다.",
            security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/me/profile-image")
    public ResponseEntity<Void> removeProfileImage() {
        userService.removeProfileImage(authenticationFacade.requireUserId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "회원 탈퇴", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/me")
    public ResponseEntity<Void> withdraw(@Valid @RequestBody(required = false) WithdrawalRequest request) {
        userService.withdraw(authenticationFacade.requireUserId(), request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "다른 회원 프로필 조회 (인증 선택)")
    @GetMapping("/{userId}")
    public PublicProfileResponse profile(@PathVariable Long userId) {
        return userService.profile(authenticationFacade.optionalUserId().orElse(null), userId);
    }

    @Operation(summary = "팔로우", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/{userId}/follow")
    public FollowResponse follow(@PathVariable Long userId) {
        return userService.follow(authenticationFacade.requireUserId(), userId, true);
    }

    @Operation(summary = "언팔로우", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/{userId}/follow")
    public FollowResponse unfollow(@PathVariable Long userId) {
        return userService.follow(authenticationFacade.requireUserId(), userId, false);
    }

    @Operation(summary = "푸시 토큰 등록·재활성화", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/me/devices")
    public ResponseEntity<DeviceResponse> registerDevice(@Valid @RequestBody DeviceRequest request) {
        var result = userService.registerDevice(authenticationFacade.requireUserId(), request);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.response());
    }

    @Operation(summary = "푸시 토큰 비활성화", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/me/devices/{deviceId}")
    public ResponseEntity<Void> deactivateDevice(@PathVariable Long deviceId) {
        userService.deactivateDevice(authenticationFacade.requireUserId(), deviceId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "팔로워 목록")
    @GetMapping("/{userId}/followers")
    public CursorPageResponse<FollowUserItem> followers(
            @PathVariable Long userId, @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return userService.followers(authenticationFacade.optionalUserId().orElse(null), userId, cursor, size);
    }

    @Operation(summary = "팔로잉 목록")
    @GetMapping("/{userId}/following")
    public CursorPageResponse<FollowUserItem> following(
            @PathVariable Long userId, @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return userService.following(authenticationFacade.optionalUserId().orElse(null), userId, cursor, size);
    }

    @Operation(summary = "최근 검색어 조회", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/me/recent-searches")
    public RecentSearchListResponse recentSearches() {
        return userService.recentSearches(authenticationFacade.requireUserId());
    }

    @Operation(summary = "최근 검색어 저장", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/me/recent-searches")
    public RecentSearchItem saveRecentSearch(@Valid @RequestBody RecentSearchRequest request) {
        return userService.saveRecentSearch(authenticationFacade.requireUserId(), request);
    }

    @Operation(summary = "최근 검색어 개별 삭제", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/me/recent-searches/{recentSearchId}")
    public ResponseEntity<Void> deleteRecentSearch(@PathVariable Long recentSearchId) {
        userService.deleteRecentSearch(authenticationFacade.requireUserId(), recentSearchId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "최근 검색어 전체 삭제", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/me/recent-searches")
    public ResponseEntity<Void> deleteRecentSearches() {
        userService.deleteAllRecentSearches(authenticationFacade.requireUserId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "차단 목록 조회", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/me/blocks")
    public CursorPageResponse<BlockedUserItem> blocks(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return userService.blocks(authenticationFacade.requireUserId(), cursor, size);
    }

    @Operation(summary = "회원 차단", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/{userId}/block")
    public BlockResponse block(@PathVariable Long userId) {
        return userService.block(authenticationFacade.requireUserId(), userId, true);
    }

    @Operation(summary = "회원 차단 취소", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/{userId}/block")
    public BlockResponse unblock(@PathVariable Long userId) {
        return userService.block(authenticationFacade.requireUserId(), userId, false);
    }

    @Operation(summary = "타투 취향 조사 저장", security = @SecurityRequirement(name = "bearerAuth"))
    @PutMapping("/me/tattoo-preferences")
    public TattooPreferenceResponse preferences(@Valid @RequestBody TattooPreferenceRequest request) {
        return userService.replacePreferences(authenticationFacade.requireUserId(), request);
    }

    @Operation(summary = "내 타투 컬렉션 조회", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/me/tattoo-collections")
    public CursorPageResponse<CollectionItem> myCollections(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        Long userId = authenticationFacade.requireUserId();
        return userService.collections(userId, userId, cursor, size, false);
    }

    @Operation(summary = "다른 회원 타투 컬렉션 조회", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/{userId}/tattoo-collections")
    public CursorPageResponse<CollectionItem> collections(
            @PathVariable Long userId, @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return userService.collections(authenticationFacade.requireUserId(), userId, cursor, size, true);
    }

    @Operation(summary = "내 타투 컬렉션 등록", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/me/tattoo-collections")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionItem createCollection(@Valid @RequestBody CollectionRequest request) {
        return userService.createCollection(authenticationFacade.requireUserId(), request);
    }

    @Operation(summary = "내 타투 컬렉션 수정", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/me/tattoo-collections/{collectionId}")
    public CollectionItem updateCollection(@PathVariable Long collectionId, @Valid @RequestBody UpdateCollectionRequest request) {
        return userService.updateCollection(authenticationFacade.requireUserId(), collectionId, request);
    }

    @Operation(summary = "내 타투 컬렉션 삭제", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/me/tattoo-collections/{collectionId}")
    public ResponseEntity<Void> deleteCollection(@PathVariable Long collectionId) {
        userService.deleteCollection(authenticationFacade.requireUserId(), collectionId);
        return ResponseEntity.noContent().build();
    }
}
