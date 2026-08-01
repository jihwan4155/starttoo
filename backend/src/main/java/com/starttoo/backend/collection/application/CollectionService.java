package com.starttoo.backend.collection.application;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CollectionService {

    private final TattooCollectionRepository collectionRepository;
    private final TattooRepository tattooRepository;
    private final TattooService tattooService;
    private final CollectionWriteService collectionWriteService;
    private final PreferenceScoreService preferenceScoreService;
    private final ImageRepository imageRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final MediaService mediaService;

    public CollectionDtos.CollectionResponse create(
            Integer userSeq,
            CollectionDtos.CreateCollectionRequest request
    ) {
        TattooService.PreparedTattoo prepared =
                tattooService.prepare(userSeq, request.imageSeq());
        CollectionWriteService.CreatedCollection created =
                collectionWriteService.create(userSeq, request, prepared);
        return response(
                created.collection(),
                created.tattoo().getImageSeq(),
                prepared.objectKey()
        );
    }

    public CursorPageResponse<CollectionDtos.CollectionResponse> list(
            Integer userSeq,
            Long cursor,
            int size
    ) {
        return collectionPage(userSeq, cursor, size);
    }

    public CursorPageResponse<CollectionDtos.CollectionResponse> byUser(
            Integer ownerSeq,
            Integer viewerSeq,
            Long cursor,
            int size
    ) {
        publicOwner(ownerSeq, viewerSeq);
        return collectionPage(ownerSeq, cursor, size);
    }

    @Transactional
    public void delete(Integer userSeq, Long collectionSeq) {
        TattooCollection collection = findOwned(userSeq, collectionSeq);
        Tattoo tattoo = tattooRepository
                .findByTattooSeqAndDeletedFalse(collection.getTattooSeq())
                .filter(value -> value.getSourceType() == TattooSourceType.USER_COLLECTION)
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        collection.softDelete();
        tattoo.softDelete();
    }

    private CursorPageResponse<CollectionDtos.CollectionResponse> collectionPage(
            Integer ownerSeq,
            Long cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("ownerSeq", ownerSeq, Types.INTEGER)
                .addValue("cursor", cursor, Types.BIGINT)
                .addValue("limit", safeSize + 1, Types.INTEGER);
        List<CollectionRow> rows = namedParameterJdbcTemplate.query("""
                SELECT collection.collection_seq,
                       collection.user_seq AS owner_seq,
                       collection.tattoo_seq,
                       tattoo.image_seq,
                       image.object_key AS image_object_key,
                       collection.body_view,
                       collection.position_x,
                       collection.position_y,
                       collection.scale_ratio,
                       collection.rotation_degree,
                       collection.is_flipped,
                       collection.reg_dttm
                  FROM tattoo_collections collection
                  JOIN tattoos tattoo
                    ON tattoo.tattoo_seq = collection.tattoo_seq
                   AND tattoo.source_type = 'USER_COLLECTION'
                   AND tattoo.is_deleted = FALSE
                  JOIN images image
                    ON image.image_seq = tattoo.image_seq
                   AND image.is_deleted = FALSE
                 WHERE collection.user_seq = :ownerSeq
                   AND collection.is_deleted = FALSE
                   AND (:cursor IS NULL OR collection.collection_seq < :cursor)
                 ORDER BY collection.collection_seq DESC
                 LIMIT :limit
                """, parameters, (rs, rowNum) -> new CollectionRow(
                rs.getLong("collection_seq"),
                rs.getInt("owner_seq"),
                rs.getLong("tattoo_seq"),
                rs.getLong("image_seq"),
                rs.getString("image_object_key"),
                rs.getString("body_view"),
                rs.getDouble("position_x"),
                rs.getDouble("position_y"),
                rs.getDouble("scale_ratio"),
                rs.getDouble("rotation_degree"),
                rs.getBoolean("is_flipped"),
                rs.getObject("reg_dttm", OffsetDateTime.class)
        ));
        boolean hasNext = rows.size() > safeSize;
        List<CollectionRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        List<CollectionDtos.CollectionResponse> items = page.stream()
                .map(row -> new CollectionDtos.CollectionResponse(
                        row.collectionSeq(),
                        row.ownerSeq(),
                        row.tattooSeq(),
                        row.imageSeq(),
                        mediaService.downloadUrl(row.imageObjectKey()),
                        row.bodyView(),
                        row.positionX(),
                        row.positionY(),
                        row.scaleRatio(),
                        row.rotationDegree(),
                        row.flipped(),
                        row.regDttm()
                ))
                .toList();
        String nextCursor = hasNext
                ? page.get(page.size() - 1).collectionSeq().toString()
                : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    private User publicOwner(Integer ownerSeq, Integer viewerSeq) {
        User owner = userRepository.findByUserSeqAndDeletedFalse(ownerSeq)
                .filter(value -> value.getAccountStatus() == AccountStatus.ACTIVE)
                .filter(value -> value.getRole() != UserRole.ADMIN)
                .orElseThrow(() -> BusinessException.of(ErrorCode.USER_NOT_FOUND));
        if (viewerSeq != null && Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1
                      FROM user_blocks
                     WHERE (blocker_seq = ? AND blocked_seq = ?)
                        OR (blocker_seq = ? AND blocked_seq = ?)
                )
                """, Boolean.class, viewerSeq, ownerSeq, ownerSeq, viewerSeq))) {
            throw BusinessException.of(ErrorCode.USER_NOT_FOUND);
        }
        return owner;
    }

    @Transactional
    public boolean setArchive(Integer userSeq, Long tattooSeq, boolean enabled) {
        if (enabled) {
            int inserted = jdbcTemplate.update("""
                    INSERT INTO user_archive (user_seq, tattoo_seq)
                    SELECT ?, td.tattoo_seq
                      FROM tattoo_designs td
                      JOIN tattoos t ON t.tattoo_seq = td.tattoo_seq
                     WHERE td.tattoo_seq = ? AND td.is_deleted = FALSE
                       AND t.is_deleted = FALSE
                    ON CONFLICT DO NOTHING
                    """, userSeq, tattooSeq);
            if (inserted == 0 && !archiveExists(userSeq, tattooSeq)) {
                throw new BusinessException(
                        ErrorCode.STATE_CONFLICT,
                        "보관함에는 tattoo_designs에 등록된 타투만 저장할 수 있습니다."
                );
            }
            if (inserted > 0) {
                preferenceScoreService.applyCollection(userSeq, tattooSeq, true);
            }
            return true;
        }
        jdbcTemplate.update(
                "DELETE FROM user_archive WHERE user_seq = ? AND tattoo_seq = ?",
                userSeq,
                tattooSeq
        );
        return false;
    }

    @Transactional(readOnly = true)
    public CursorPageResponse<CollectionDtos.TattooDesignItem> archive(
            Integer userSeq,
            String cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        ArchiveCursor decoded = decodeArchiveCursor(cursor);
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("userSeq", userSeq, Types.INTEGER)
                .addValue("cursorDttm", decoded == null ? null : decoded.archivedDttm(),
                        Types.TIMESTAMP_WITH_TIMEZONE)
                .addValue("cursorTattooSeq", decoded == null ? null : decoded.tattooSeq(),
                        Types.BIGINT)
                .addValue("limit", safeSize + 1, Types.INTEGER);
        List<ArchiveRow> rows = namedParameterJdbcTemplate.query("""
                SELECT ua.tattoo_seq,
                       td.image_seq AS design_image_seq,
                       i.object_key AS design_object_key,
                       ua.reg_dttm AS archived_dttm
                  FROM user_archive ua
                  JOIN tattoo_designs td
                    ON td.tattoo_seq = ua.tattoo_seq
                   AND td.is_deleted = FALSE
                  JOIN tattoos t
                    ON t.tattoo_seq = ua.tattoo_seq
                   AND t.is_deleted = FALSE
                  JOIN images i
                    ON i.image_seq = td.image_seq
                   AND i.is_deleted = FALSE
                 WHERE ua.user_seq = :userSeq
                   AND (
                       CAST(:cursorDttm AS timestamptz) IS NULL
                       OR ua.reg_dttm < :cursorDttm
                       OR (
                           ua.reg_dttm = :cursorDttm
                           AND ua.tattoo_seq < :cursorTattooSeq
                       )
                   )
                 ORDER BY ua.reg_dttm DESC, ua.tattoo_seq DESC
                 LIMIT :limit
                """, parameters, (rs, rowNum) -> new ArchiveRow(
                rs.getLong("tattoo_seq"),
                rs.getLong("design_image_seq"),
                rs.getString("design_object_key"),
                rs.getObject("archived_dttm", OffsetDateTime.class)
        ));
        boolean hasNext = rows.size() > safeSize;
        List<ArchiveRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        List<CollectionDtos.TattooDesignItem> items = page.stream()
                .map(row -> new CollectionDtos.TattooDesignItem(
                        row.tattooSeq(),
                        row.designImageSeq(),
                        mediaService.downloadUrl(row.designObjectKey()),
                        row.archivedDttm()
                ))
                .toList();
        String nextCursor = hasNext ? encodeArchiveCursor(page.get(page.size() - 1)) : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    private ArchiveCursor decodeArchiveCursor(String cursor) {
        if (cursor == null) {
            return null;
        }
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(cursor),
                    StandardCharsets.UTF_8
            );
            String[] values = decoded.split("\\|", -1);
            return new ArchiveCursor(OffsetDateTime.parse(values[0]), Long.parseLong(values[1]));
        } catch (RuntimeException exception) {
            throw BusinessException.of(ErrorCode.INVALID_CURSOR);
        }
    }

    private String encodeArchiveCursor(ArchiveRow row) {
        String value = row.archivedDttm() + "|" + row.tattooSeq();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private record ArchiveCursor(
            OffsetDateTime archivedDttm,
            Long tattooSeq
    ) {
    }

    private record ArchiveRow(
            Long tattooSeq,
            Long designImageSeq,
            String designObjectKey,
            OffsetDateTime archivedDttm
    ) {
    }

    private boolean archiveExists(Integer userSeq, Long tattooSeq) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT EXISTS(
                    SELECT 1 FROM user_archive WHERE user_seq = ? AND tattoo_seq = ?
                )
                """, Boolean.class, userSeq, tattooSeq));
    }

    private TattooCollection findOwned(Integer userSeq, Long collectionSeq) {
        return collectionRepository.findByCollectionSeqAndUserSeqAndDeletedFalse(
                collectionSeq,
                userSeq
        ).orElseThrow(() -> BusinessException.of(ErrorCode.RESOURCE_NOT_FOUND));
    }

    private CollectionDtos.CollectionResponse response(
            TattooCollection collection,
            Long imageSeq,
            String imageObjectKey
    ) {
        return new CollectionDtos.CollectionResponse(
                collection.getCollectionSeq(),
                collection.getUserSeq(),
                collection.getTattooSeq(),
                imageSeq,
                mediaService.downloadUrl(imageObjectKey),
                collection.getBodyView(),
                collection.getPositionX(),
                collection.getPositionY(),
                collection.getScaleRatio(),
                collection.getRotationDegree(),
                collection.isFlipped(),
                collection.getRegDttm()
        );
    }

    private record CollectionRow(
            Long collectionSeq,
            Integer ownerSeq,
            Long tattooSeq,
            Long imageSeq,
            String imageObjectKey,
            String bodyView,
            double positionX,
            double positionY,
            double scaleRatio,
            double rotationDegree,
            boolean flipped,
            OffsetDateTime regDttm
    ) {
    }
}
