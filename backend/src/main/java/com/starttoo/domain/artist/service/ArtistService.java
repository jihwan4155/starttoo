package com.starttoo.domain.artist.service;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.common.pagination.CursorValues;
import com.starttoo.domain.artist.dto.ArtistDtos.*;
import com.starttoo.domain.artist.entity.TattooArtistEntity;
import com.starttoo.domain.artist.repository.TattooArtistRepository;
import com.starttoo.domain.image.service.ImageReferenceService;
import com.starttoo.domain.post.repository.PostHiddenPreferenceRepository;
import com.starttoo.domain.post.repository.PostImageRepository;
import com.starttoo.domain.post.repository.PostRepository;
import com.starttoo.domain.social.entity.UserFollowId;
import com.starttoo.domain.social.repository.UserBlockRepository;
import com.starttoo.domain.social.repository.UserFollowRepository;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class ArtistService {
    private final TattooArtistRepository artistRepository;
    private final UserRepository userRepository;
    private final UserFollowRepository followRepository;
    private final UserBlockRepository blockRepository;
    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;
    private final PostHiddenPreferenceRepository hiddenRepository;
    private final ImageReferenceService imageReferenceService;
    private final CursorCodec cursorCodec;

    @Transactional(readOnly = true)
    public CursorPageResponse<ArtistItem> search(Long viewerId, String shopCity, String nickname, String cursor, int size) {
        shopCity = normalize(shopCity);
        nickname = normalize(nickname);
        var values = cursorCodec.decode(cursor);
        BigDecimal popularity = CursorValues.decimalValue(values, "popularity");
        Long userId = popularity == null ? null : CursorValues.longValue(values, "userId", Long.MAX_VALUE);
        boolean nicknameSearch = nickname != null;
        boolean sourceHasNext;
        List<TattooArtistEntity> rows;
        long pageNumber = CursorValues.longValue(values, "page", 0);
        if (nicknameSearch) {
            var slice = artistRepository.searchByNickname(shopCity, nickname, PageRequest.of((int) pageNumber, size));
            rows = slice.getContent();
            sourceHasNext = slice.hasNext();
        } else {
            rows = artistRepository.searchPopular(shopCity, popularity, userId, PageRequest.of(0, size + 1));
            sourceHasNext = rows.size() > size;
        }
        if (viewerId != null) {
            rows = rows.stream().filter(a -> !blockRepository.existsEitherDirection(viewerId, a.getUserId())).toList();
        }
        boolean hasNext = sourceHasNext && !rows.isEmpty();
        var page = rows.subList(0, Math.min(size, rows.size()));
        var items = page.stream().map(a -> item(viewerId, a)).toList();
        String next = hasNext ? nicknameSearch
                ? cursorCodec.encode(Map.of("page", pageNumber + 1, "filter", "nickname"))
                : cursorCodec.encode(Map.of("popularity", page.getLast().getPopularity(), "userId", page.getLast().getUserId()))
                : null;
        return new CursorPageResponse<>(items, next, hasNext);
    }

    @Transactional
    public ArtistProfileResponse update(Long userId, UpdateArtistRequest request) {
        var artist = artistRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ARTIST_PROFILE_NOT_FOUND));
        artist.updateProfile(trimNullable(request.shopName()), trimNullable(request.shopCity()),
                trimNullable(request.shopAddress()), trimNullable(request.shopPhone()), trimNullable(request.businessHours()));
        return response(artist);
    }

    private ArtistItem item(Long viewerId, TattooArtistEntity artist) {
        var user = userRepository.findById(artist.getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        var previews = postRepository.findAllByAuthorIdAndPostStatusOrderByPostIdDesc(
                        artist.getUserId(), "PUBLISHED", PageRequest.of(0, 12)).stream()
                .filter(post -> viewerId == null || !hiddenRepository.existsById(new com.starttoo.domain.post.entity.PostUserId(post.getPostId(), viewerId)))
                .flatMap(post -> postImageRepository.findAllByPostIdOrderByDisplayOrderAsc(post.getPostId()).stream().limit(1)
                        .map(image -> new FeedPreview(post.getPostId(), imageReferenceService.url(image.getImageId()), post.getLikeCount())))
                .limit(6).toList();
        return new ArtistItem(artist.getUserId(), user.getNickname(), imageReferenceService.url(user.getProfileImageKey()),
                new Shop(artist.getShopName(), artist.getShopCity(), artist.getShopAddress(), artist.getShopPhone(), artist.getBusinessHours()),
                artist.getApprovalStatus(), artist.getPopularity(), followRepository.countByIdFollowingId(artist.getUserId()),
                viewerId != null && followRepository.existsById(new UserFollowId(viewerId, artist.getUserId())),
                viewerId != null && viewerId.equals(artist.getUserId()), previews);
    }

    private ArtistProfileResponse response(TattooArtistEntity a) {
        return new ArtistProfileResponse(a.getUserId(), a.getShopName(), a.getShopCity(), a.getShopAddress(),
                a.getShopPhone(), a.getBusinessHours(), a.getPopularity(), a.getApprovalStatus(),
                a.getRejectionReason(), toInstant(a.getApprovedAt()), toInstant(a.getUpdatedAt()));
    }

    private String normalize(String value) {
        if (value == null) return null;
        String result = value.trim();
        return result.isEmpty() ? null : result;
    }
    private String trimNullable(String value) { return value == null ? null : value.trim(); }
}
