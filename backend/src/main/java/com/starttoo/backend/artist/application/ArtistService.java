package com.starttoo.backend.artist.application;

import com.starttoo.backend.artist.api.ArtistDtos;
import com.starttoo.backend.artist.domain.Artist;
import com.starttoo.backend.artist.domain.ArtistRepository;
import com.starttoo.backend.artist.domain.VerificationStatus;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ArtistService {

    private final ArtistRepository artistRepository;
    private final UserService userService;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final MediaService mediaService;

    private ArtistDtos.ArtistProfile profile(Integer userSeq) {
        Artist artist = artistRepository.findByUserSeqAndDeletedFalse(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.ARTIST_NOT_FOUND));
        User user = userService.find(userSeq);
        Long followerCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_follows WHERE following_seq = ?",
                Long.class,
                userSeq
        );
        return toProfile(artist, user, followerCount == null ? 0 : followerCount);
    }

    @Transactional
    public ArtistDtos.ArtistProfile update(Integer userSeq, ArtistDtos.UpdateArtistRequest request) {
        User user = userService.find(userSeq);
        if (user.getRole() != UserRole.ARTIST) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        Artist artist = artistRepository.findActiveForUpdate(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.ARTIST_NOT_FOUND));
        artist.updateShop(
                request.shopName(),
                request.shopCity(),
                request.shopAddress(),
                request.shopPhone(),
                request.shopDetails(),
                userSeq
        );
        return profile(userSeq);
    }

    @Transactional
    public ArtistDtos.ArtistProfile verify(Integer userSeq) {
        User user = userService.find(userSeq);
        if (user.getRole() != UserRole.ARTIST) {
            throw BusinessException.of(ErrorCode.FORBIDDEN);
        }
        Artist artist = artistRepository.findActiveForUpdate(userSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.ARTIST_NOT_FOUND));
        if (artist.getVerificationStatus() == VerificationStatus.VERIFIED) {
            throw BusinessException.of(ErrorCode.STATE_CONFLICT);
        }
        artist.processVerification(VerificationStatus.VERIFIED, null, userSeq);
        return profile(userSeq);
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<ArtistDtos.ArtistListItem> list(
            String cursor,
            int size,
            String city,
            Integer viewerSeq
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        ArtistCursor decoded = decodeCursor(cursor);
        String sql = """
                SELECT a.user_seq,
                       u.nickname,
                       u.profile_image_seq,
                       i.object_key AS profile_object_key,
                       a.shop_name,
                       a.shop_city,
                       a.shop_address,
                       a.shop_phone,
                       a.shop_details,
                       a.verification_status,
                       a.reg_dttm,
                       COALESCE(f.followers, 0) AS follower_count
                  FROM artists a
                  JOIN users u ON u.user_seq = a.user_seq
                  LEFT JOIN images i
                    ON i.image_seq = u.profile_image_seq
                   AND i.is_deleted = FALSE
                  LEFT JOIN (
                      SELECT following_seq, COUNT(*) AS followers
                        FROM user_follows GROUP BY following_seq
                  ) f ON f.following_seq = a.user_seq
                 WHERE a.verification_status = 'VERIFIED'
                   AND a.is_deleted = FALSE
                   AND u.role = 'ARTIST'
                   AND u.account_status = 'ACTIVE'
                   AND u.is_deleted = FALSE
                   AND (CAST(? AS VARCHAR) IS NULL OR a.shop_city = ?)
                   AND (
                       CAST(? AS INTEGER) IS NULL OR NOT EXISTS (
                           SELECT 1
                             FROM user_blocks block
                            WHERE (
                                block.blocker_seq = ?
                                AND block.blocked_seq = a.user_seq
                            ) OR (
                                block.blocker_seq = a.user_seq
                                AND block.blocked_seq = ?
                            )
                       )
                   )
                   AND (
                       CAST(? AS INTEGER) IS NULL
                       OR COALESCE(f.followers, 0) < ?
                       OR (
                           COALESCE(f.followers, 0) = ?
                           AND a.user_seq < ?
                       )
                   )
                 ORDER BY COALESCE(f.followers, 0) DESC, a.user_seq DESC
                 LIMIT ?
                """;
        List<Row> rows = jdbcTemplate.query(
                sql,
                (rs, rowNum) -> {
                    Integer userSeq = rs.getInt("user_seq");
                    long followerCount = rs.getLong("follower_count");
                    ArtistDtos.ArtistProfile profile = new ArtistDtos.ArtistProfile(
                            userSeq,
                            rs.getString("nickname"),
                            rs.getObject("profile_image_seq", Long.class),
                            downloadUrl(rs.getString("profile_object_key")),
                            rs.getString("shop_name"),
                            rs.getString("shop_city"),
                            rs.getString("shop_address"),
                            rs.getString("shop_phone"),
                            rs.getString("shop_details"),
                            VerificationStatus.valueOf(rs.getString("verification_status")),
                            followerCount,
                            rs.getObject("reg_dttm", OffsetDateTime.class)
                    );
                    return new Row(userSeq, followerCount, profile);
                },
                city, city,
                viewerSeq, viewerSeq, viewerSeq,
                decoded == null ? null : decoded.userSeq(),
                decoded == null ? null : decoded.followerCount(),
                decoded == null ? null : decoded.followerCount(),
                decoded == null ? null : decoded.userSeq(),
                safeSize + 1
        );
        boolean hasNext = rows.size() > safeSize;
        List<Row> page = hasNext ? rows.subList(0, safeSize) : rows;
        Map<Integer, List<ArtistDtos.ArtistPostSummary>> posts = recentPosts(
                page.stream().map(Row::userSeq).toList()
        );
        List<ArtistDtos.ArtistListItem> items = page.stream()
                .map(row -> toListItem(
                        row.profile(),
                        posts.getOrDefault(row.userSeq(), List.of())
                ))
                .toList();
        String nextCursor = hasNext ? encodeCursor(page.get(page.size() - 1)) : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    private ArtistDtos.ArtistProfile toProfile(Artist artist, User user, long followerCount) {
        return new ArtistDtos.ArtistProfile(
                user.getUserSeq(),
                user.getNickname(),
                user.getProfileImageSeq(),
                profileImageUrl(user.getProfileImageSeq()),
                artist.getShopName(),
                artist.getShopCity(),
                artist.getShopAddress(),
                artist.getShopPhone(),
                artist.getShopDetails(),
                artist.getVerificationStatus(),
                followerCount,
                artist.getRegDttm()
        );
    }

    private ArtistDtos.ArtistListItem toListItem(
            ArtistDtos.ArtistProfile profile,
            List<ArtistDtos.ArtistPostSummary> posts
    ) {
        return new ArtistDtos.ArtistListItem(
                profile.userSeq(),
                profile.nickname(),
                profile.profileImageSeq(),
                profile.profileImageUrl(),
                profile.shopName(),
                profile.shopCity(),
                profile.shopAddress(),
                profile.shopPhone(),
                profile.shopDetails(),
                profile.verificationStatus(),
                profile.followerCount(),
                posts,
                profile.regDttm()
        );
    }

    private Map<Integer, List<ArtistDtos.ArtistPostSummary>> recentPosts(
            List<Integer> artistSeqs
    ) {
        if (artistSeqs.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<ArtistDtos.ArtistPostSummary>> result = new HashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT ranked.author_seq,
                       ranked.post_seq,
                       ranked.image_object_key,
                       ranked.like_count
                  FROM (
                      SELECT post.author_seq,
                             post.post_seq,
                             image.object_key AS image_object_key,
                             post.like_count,
                             ROW_NUMBER() OVER (
                                 PARTITION BY post.author_seq
                                 ORDER BY post.post_seq DESC
                             ) AS row_number
                        FROM posts post
                        JOIN post_images post_image
                          ON post_image.post_seq = post.post_seq
                         AND post_image.display_order = 1
                        JOIN images image
                          ON image.image_seq = post_image.image_seq
                         AND image.is_deleted = FALSE
                       WHERE post.author_seq IN (:artistSeqs)
                         AND post.post_status = 'PUBLISHED'
                         AND post.is_deleted = FALSE
                  ) ranked
                 WHERE ranked.row_number <= 6
                 ORDER BY ranked.author_seq, ranked.post_seq DESC
                """, new MapSqlParameterSource("artistSeqs", artistSeqs), rs -> {
            int artistSeq = rs.getInt("author_seq");
            result.computeIfAbsent(artistSeq, ignored -> new java.util.ArrayList<>())
                    .add(new ArtistDtos.ArtistPostSummary(
                            rs.getLong("post_seq"),
                            downloadUrl(rs.getString("image_object_key")),
                            rs.getInt("like_count")
                    ));
        });
        return result;
    }

    private String profileImageUrl(Long profileImageSeq) {
        if (profileImageSeq == null) {
            return null;
        }
        List<String> objectKeys = jdbcTemplate.queryForList("""
                SELECT object_key
                  FROM images
                 WHERE image_seq = ? AND is_deleted = FALSE
                """, String.class, profileImageSeq);
        return objectKeys.isEmpty() ? null : downloadUrl(objectKeys.get(0));
    }

    private String downloadUrl(String objectKey) {
        return objectKey == null ? null : mediaService.downloadUrl(objectKey);
    }

    private record Row(
            Integer userSeq,
            long followerCount,
            ArtistDtos.ArtistProfile profile
    ) {
    }

    private ArtistCursor decodeCursor(String cursor) {
        if (cursor == null) {
            return null;
        }
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(cursor),
                    StandardCharsets.UTF_8
            );
            String[] values = decoded.split(":", -1);
            return new ArtistCursor(Long.parseLong(values[0]), Integer.parseInt(values[1]));
        } catch (RuntimeException exception) {
            throw BusinessException.of(ErrorCode.INVALID_CURSOR);
        }
    }

    private String encodeCursor(Row row) {
        String value = row.followerCount() + ":" + row.userSeq();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private record ArtistCursor(long followerCount, Integer userSeq) {
    }
}
