package com.starttoo.domain.user.service;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.common.pagination.CursorValues;
import com.starttoo.config.properties.ProfileImageProperties;
import com.starttoo.domain.artist.entity.TattooArtistEntity;
import com.starttoo.domain.artist.repository.TattooArtistRepository;
import com.starttoo.domain.auth.service.RefreshTokenService;
import com.starttoo.domain.image.service.ImageReferenceService;
import com.starttoo.domain.image.service.ObjectStoragePort;
import com.starttoo.domain.search.entity.UserRecentSearchEntity;
import com.starttoo.domain.search.repository.UserRecentSearchRepository;
import com.starttoo.domain.social.entity.UserBlockEntity;
import com.starttoo.domain.social.entity.UserBlockId;
import com.starttoo.domain.social.entity.UserFollowEntity;
import com.starttoo.domain.social.entity.UserFollowId;
import com.starttoo.domain.social.repository.UserBlockRepository;
import com.starttoo.domain.social.repository.UserFollowRepository;
import com.starttoo.domain.tattoo.entity.TattooCollectionEntity;
import com.starttoo.domain.tattoo.repository.TattooCollectionRepository;
import com.starttoo.domain.tattoo.repository.TattooRepository;
import com.starttoo.domain.user.dto.UserDtos.*;
import com.starttoo.domain.user.entity.UserDeviceEntity;
import com.starttoo.domain.user.entity.UserEntity;
import com.starttoo.domain.user.entity.UserTattooPreferenceEntity;
import com.starttoo.domain.user.entity.UserTattooPreferenceId;
import com.starttoo.domain.user.repository.UserDeviceRepository;
import com.starttoo.domain.user.repository.UserRepository;
import com.starttoo.domain.user.repository.UserTattooPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final TattooArtistRepository artistRepository;
    private final UserFollowRepository followRepository;
    private final UserBlockRepository blockRepository;
    private final UserDeviceRepository deviceRepository;
    private final UserRecentSearchRepository recentSearchRepository;
    private final TattooCollectionRepository collectionRepository;
    private final TattooRepository tattooRepository;
    private final UserTattooPreferenceRepository preferenceRepository;
    private final ImageReferenceService imageReferenceService;
    private final ObjectStoragePort objectStoragePort;
    private final RefreshTokenService refreshTokenService;
    private final ProfileImageProperties profileImageProperties;
    private final CursorCodec cursorCodec;
    private final Clock clock = Clock.systemUTC();

    @Transactional(readOnly = true)
    public MeResponse me(Long userId) {
        UserEntity user = requireActive(userId);
        return new MeResponse(
                user.getUserId(), user.getEmail(), user.getNickname(), imageReferenceService.url(user.getProfileImageKey()),
                user.getBirthDate(), user.getGender(), user.getRole(), user.getAccountStatus(),
                followRepository.countByIdFollowingId(userId), followRepository.countByIdFollowerId(userId),
                artistRepository.findById(userId).map(this::artistInfo).orElse(null), toInstant(user.getCreatedAt())
        );
    }

    @Transactional
    public UpdateMeResponse updateMe(Long userId, UpdateMeRequest request) {
        UserEntity user = requireActive(userId);
        String nickname = request.nickname() == null ? user.getNickname() : request.nickname().trim();
        if (nickname.length() < 2 || nickname.length() > 50) {
            throw new BusinessException(ErrorCode.NICKNAME_FORMAT_INVALID);
        }
        if (userRepository.existsByNicknameAndUserIdNot(nickname, userId)) {
            throw new BusinessException(ErrorCode.NICKNAME_DUPLICATED);
        }
        if (Boolean.TRUE.equals(request.removeBirthDate()) && request.birthDate() != null)
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "생년월일 등록과 삭제를 동시에 요청할 수 없습니다.");
        if (Boolean.TRUE.equals(request.removeGender()) && request.gender() != null)
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "성별 등록과 삭제를 동시에 요청할 수 없습니다.");
        var birthDate = Boolean.TRUE.equals(request.removeBirthDate()) ? null
                : request.birthDate() == null ? user.getBirthDate() : request.birthDate();
        var gender = Boolean.TRUE.equals(request.removeGender()) ? null
                : request.gender() == null ? user.getGender() : request.gender();
        user.updateProfile(nickname, birthDate, gender);
        return new UpdateMeResponse(userId, nickname, user.getBirthDate(), user.getGender(),
                user.getRole(), Instant.now(clock));
    }

    @Transactional
    public ProfileImageResponse updateProfileImage(Long userId, ProfileImageRequest request) {
        UserEntity user = requireActive(userId);
        String objectKey = request.profileImageObjectKey();
        objectStoragePort.verifyUploadedObject(objectKey, userId);
        user.updateProfileImage(objectKey);
        return new ProfileImageResponse(objectStoragePort.createDownloadUrl(objectKey), Instant.now(clock));
    }

    @Transactional
    public void removeProfileImage(Long userId) {
        UserEntity user = requireActive(userId);
        user.resetProfileImage(profileImageProperties.getDefaultImageKey());
    }

    @Transactional(readOnly = true)
    public PublicProfileResponse profile(Long viewerId, Long targetId) {
        UserEntity target = requireVisible(viewerId, targetId);
        boolean authenticated = viewerId != null;
        boolean following = authenticated && followRepository.existsById(new UserFollowId(viewerId, targetId));
        return new PublicProfileResponse(
                targetId, target.getNickname(), imageReferenceService.url(target.getProfileImageKey()), target.getRole(),
                followRepository.countByIdFollowingId(targetId), followRepository.countByIdFollowerId(targetId),
                following, authenticated && viewerId.equals(targetId),
                artistRepository.findById(targetId).map(this::publicArtistInfo).orElse(null)
        );
    }

    @Transactional
    public FollowResponse follow(Long userId, Long targetId, boolean enabled) {
        if (userId.equals(targetId)) throw new BusinessException(ErrorCode.CANNOT_FOLLOW_SELF);
        requireVisible(userId, targetId);
        UserFollowId id = new UserFollowId(userId, targetId);
        if (enabled && !followRepository.existsById(id)) {
            followRepository.save(UserFollowEntity.builder().id(id).build());
        } else if (!enabled && followRepository.existsById(id)) {
            followRepository.deleteById(id);
        }
        return new FollowResponse(targetId, enabled, followRepository.countByIdFollowingId(targetId));
    }

    @Transactional
    public DeviceRegistration registerDevice(Long userId, DeviceRequest request) {
        String platform = request.platform().toUpperCase();
        if (!List.of("WEB", "ANDROID", "IOS").contains(platform)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "지원하지 않는 기기 플랫폼입니다.");
        }
        var existing = deviceRepository.findByPushToken(request.pushToken());
        boolean created = existing.isEmpty();
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        UserDeviceEntity device = existing.orElseGet(() -> UserDeviceEntity.builder()
                .pushToken(request.pushToken()).userId(userId).platform(platform).active(true).lastUsedAt(now).build());
        device.activate(userId, platform, now);
        deviceRepository.saveAndFlush(device);
        return new DeviceRegistration(created, new DeviceResponse(device.getDeviceId(), platform, true,
                toInstant(device.getLastUsedAt()), toInstant(device.getCreatedAt())));
    }

    @Transactional
    public void deactivateDevice(Long userId, Long deviceId) {
        UserDeviceEntity device = deviceRepository.findByDeviceIdAndUserId(deviceId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DEVICE_NOT_FOUND));
        device.deactivate();
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<FollowUserItem> followers(Long viewerId, Long targetId, String cursor, int size) {
        requireVisible(viewerId, targetId);
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "userId", Long.MAX_VALUE);
        var rows = followRepository.findAllByIdFollowingIdAndIdFollowerIdLessThanOrderByIdFollowerIdDesc(
                targetId, before, PageRequest.of(0, size + 1));
        return followPage(viewerId, rows, true, size);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<FollowUserItem> following(Long viewerId, Long targetId, String cursor, int size) {
        requireVisible(viewerId, targetId);
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "userId", Long.MAX_VALUE);
        var rows = followRepository.findAllByIdFollowerIdAndIdFollowingIdLessThanOrderByIdFollowingIdDesc(
                targetId, before, PageRequest.of(0, size + 1));
        return followPage(viewerId, rows, false, size);
    }

    @Transactional(readOnly = true)
    public RecentSearchListResponse recentSearches(Long userId) {
        var items = recentSearchRepository.findAllByUserIdOrderBySearchedAtDesc(userId, PageRequest.of(0, 10))
                .stream().map(this::recentItem).toList();
        return new RecentSearchListResponse(items);
    }

    @Transactional
    public RecentSearchItem saveRecentSearch(Long userId, RecentSearchRequest request) {
        String keyword = request.keyword().trim();
        if (keyword.isEmpty()) throw new BusinessException(ErrorCode.INVALID_REQUEST);
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        UserRecentSearchEntity value = recentSearchRepository.findByUserIdAndKeyword(userId, keyword)
                .orElseGet(() -> UserRecentSearchEntity.builder().userId(userId).keyword(keyword).build());
        value.touch(now);
        recentSearchRepository.saveAndFlush(value);
        var all = recentSearchRepository.findAllByUserIdOrderBySearchedAtDesc(userId, PageRequest.of(0, 100));
        if (all.size() > 10) recentSearchRepository.deleteAll(all.subList(10, all.size()));
        return recentItem(value);
    }

    @Transactional
    public void deleteRecentSearch(Long userId, Long id) {
        var value = recentSearchRepository.findByRecentSearchIdAndUserId(id, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RECENT_SEARCH_NOT_FOUND));
        recentSearchRepository.delete(value);
    }

    @Transactional
    public void deleteAllRecentSearches(Long userId) {
        recentSearchRepository.deleteAllByUserId(userId);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<BlockedUserItem> blocks(Long userId, String cursor, int size) {
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "userId", Long.MAX_VALUE);
        var rows = blockRepository.findAllByIdBlockerIdAndIdBlockedIdLessThanOrderByIdBlockedIdDesc(
                userId, before, PageRequest.of(0, size + 1));
        boolean hasNext = rows.size() > size;
        var page = rows.subList(0, Math.min(size, rows.size()));
        var items = page.stream().map(row -> {
            UserEntity user = userRepository.findById(row.getId().getBlockedId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
            return new BlockedUserItem(user.getUserId(), user.getNickname(),
                    imageReferenceService.url(user.getProfileImageKey()), toInstant(row.getCreatedAt()));
        }).toList();
        String next = hasNext ? cursorCodec.encode(Map.of("userId", page.getLast().getId().getBlockedId())) : null;
        return new CursorPageResponse<>(items, next, hasNext);
    }

    @Transactional
    public BlockResponse block(Long userId, Long targetId, boolean enabled) {
        if (userId.equals(targetId)) throw new BusinessException(ErrorCode.CANNOT_BLOCK_SELF);
        if (enabled) requireActive(targetId);
        UserBlockId id = new UserBlockId(userId, targetId);
        if (enabled && !blockRepository.existsById(id)) {
            blockRepository.save(UserBlockEntity.builder().id(id).build());
            followRepository.deleteByIdFollowerIdAndIdFollowingId(userId, targetId);
            followRepository.deleteByIdFollowerIdAndIdFollowingId(targetId, userId);
        } else if (!enabled && blockRepository.existsById(id)) {
            blockRepository.deleteById(id);
        }
        return new BlockResponse(targetId, enabled);
    }

    @Transactional
    public TattooPreferenceResponse replacePreferences(Long userId, TattooPreferenceRequest request) {
        if (new HashSet<>(request.tattooIds()).size() != request.tattooIds().size()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "타투 ID 목록에 중복 값이 있습니다.");
        }
        if (tattooRepository.findAllById(request.tattooIds()).size() != request.tattooIds().size()) {
            throw new BusinessException(ErrorCode.TATTOO_NOT_FOUND);
        }
        preferenceRepository.deleteAllByIdUserIdAndIdPreferenceSource(userId, "SURVEY");
        BigDecimal score = request.score() == null ? new BigDecimal("1.0000") : request.score();
        var values = request.tattooIds().stream().map(id -> UserTattooPreferenceEntity.builder()
                .id(new UserTattooPreferenceId(userId, id, "SURVEY")).score(score).build()).toList();
        preferenceRepository.saveAll(values);
        return new TattooPreferenceResponse("SURVEY", request.tattooIds(), values.size(), Instant.now(clock));
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<CollectionItem> collections(Long requesterId, Long targetId, String cursor, int size, boolean rejectSelf) {
        if (rejectSelf && requesterId.equals(targetId)) throw new BusinessException(ErrorCode.USE_MY_COLLECTION_ENDPOINT);
        requireVisible(requesterId, targetId);
        long before = CursorValues.longValue(cursorCodec.decode(cursor), "collectionId", Long.MAX_VALUE);
        var rows = collectionRepository.findAllByUserIdAndCollectionIdLessThanOrderByCollectionIdDesc(
                targetId, before, PageRequest.of(0, size + 1));
        boolean hasNext = rows.size() > size;
        var page = rows.subList(0, Math.min(size, rows.size()));
        var items = page.stream().map(this::collectionItem).toList();
        String next = hasNext ? cursorCodec.encode(Map.of("collectionId", page.getLast().getCollectionId())) : null;
        return new CursorPageResponse<>(items, next, hasNext);
    }

    @Transactional
    public CollectionItem createCollection(Long userId, CollectionRequest request) {
        var image = imageReferenceService.register(request.imageObjectKey(), userId);
        var value = collectionRepository.saveAndFlush(TattooCollectionEntity.builder()
                .userId(userId).bodyPart(request.bodyPart().trim()).collectionImageId(image.getImageId()).build());
        return collectionItem(value);
    }

    @Transactional
    public CollectionItem updateCollection(Long userId, Long collectionId, UpdateCollectionRequest request) {
        var value = collectionRepository.findByCollectionIdAndUserId(collectionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_COLLECTION_NOT_FOUND));
        Long imageId = value.getCollectionImageId();
        if (request.imageObjectKey() != null) {
            imageId = imageReferenceService.register(request.imageObjectKey(), userId).getImageId();
        }
        String bodyPart = request.bodyPart() == null ? value.getBodyPart() : request.bodyPart().trim();
        if (bodyPart.isEmpty()) throw new BusinessException(ErrorCode.INVALID_REQUEST);
        value.update(bodyPart, imageId);
        return collectionItem(value);
    }

    @Transactional
    public void deleteCollection(Long userId, Long collectionId) {
        var value = collectionRepository.findByCollectionIdAndUserId(collectionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_COLLECTION_NOT_FOUND));
        collectionRepository.delete(value);
    }

    @Transactional
    public void withdraw(Long userId, WithdrawalRequest request) {
        UserEntity user = requireActive(userId);
        user.withdraw(request == null ? null : request.reason(), LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
        refreshTokenService.revokeAll(userId);
        deviceRepository.findAllByUserIdAndActiveTrue(userId).forEach(UserDeviceEntity::deactivate);
    }

    private CursorPageResponse<FollowUserItem> followPage(Long viewerId, List<UserFollowEntity> rows, boolean followerRows, int size) {
        boolean hasNext = rows.size() > size;
        var page = rows.subList(0, Math.min(size, rows.size()));
        var items = page.stream().map(row -> {
            long relatedId = followerRows ? row.getId().getFollowerId() : row.getId().getFollowingId();
            UserEntity user = requireActive(relatedId);
            boolean isFollowing = viewerId != null && followRepository.existsById(new UserFollowId(viewerId, relatedId));
            return new FollowUserItem(relatedId, user.getNickname(), imageReferenceService.url(user.getProfileImageKey()),
                    user.getRole(), isFollowing, toInstant(row.getCreatedAt()));
        }).filter(item -> viewerId == null || !blockRepository.existsEitherDirection(viewerId, item.userId())).toList();
        Long nextId = page.isEmpty() ? null : followerRows ? page.getLast().getId().getFollowerId() : page.getLast().getId().getFollowingId();
        String next = hasNext ? cursorCodec.encode(Map.of("userId", nextId)) : null;
        return new CursorPageResponse<>(items, next, hasNext);
    }

    private CollectionItem collectionItem(TattooCollectionEntity value) {
        return new CollectionItem(value.getCollectionId(), value.getUserId(), value.getBodyPart(),
                value.getCollectionImageId(), imageReferenceService.url(value.getCollectionImageId()),
                toInstant(value.getCreatedAt()), toInstant(value.getUpdatedAt()));
    }

    private RecentSearchItem recentItem(UserRecentSearchEntity value) {
        return new RecentSearchItem(value.getRecentSearchId(), value.getKeyword(), toInstant(value.getSearchedAt()));
    }

    private ArtistInfo artistInfo(TattooArtistEntity value) {
        return new ArtistInfo(value.getShopName(), value.getShopCity(), value.getShopAddress(), value.getShopPhone(),
                value.getBusinessHours(), value.getPopularity(), value.getApprovalStatus(), value.getRejectionReason(),
                toInstant(value.getApprovedAt()));
    }

    private ArtistInfo publicArtistInfo(TattooArtistEntity value) {
        return new ArtistInfo(value.getShopName(), value.getShopCity(), value.getShopAddress(), value.getShopPhone(),
                value.getBusinessHours(), value.getPopularity(), value.getApprovalStatus(), null, null);
    }

    private UserEntity requireVisible(Long viewerId, Long targetId) {
        if (viewerId != null && !viewerId.equals(targetId) && blockRepository.existsEitherDirection(viewerId, targetId)) {
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }
        return requireActive(targetId);
    }

    private UserEntity requireActive(Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        if (!"ACTIVE".equals(user.getAccountStatus())) throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        return user;
    }

    public record DeviceRegistration(boolean created, DeviceResponse response) {
    }
}
