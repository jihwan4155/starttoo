package com.starttoo.backend.collection.application;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.config.CollectionProperties;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooDesign;
import com.starttoo.backend.tattoo.domain.TattooDesignRepository;
import com.starttoo.backend.tattoo.domain.TattooRepository;
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

    /** 보관 요청을 회원 단위로 직렬화할 때 쓰는 advisory lock 네임스페이스 ('ARCH'). */
    private static final int ARCHIVE_LOCK_NAMESPACE = 0x41524348;

    private final TattooCollectionRepository collectionRepository;
    private final TattooRepository tattooRepository;
    private final TattooDesignRepository tattooDesignRepository;
    private final CollectionWriteService collectionWriteService;
    private final PreferenceScoreService preferenceScoreService;
    private final ImageRepository imageRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final MediaService mediaService;
    private final CollectionProperties collectionProperties;

    public CollectionDtos.CollectionResponse create(
            Integer userSeq,
            CollectionDtos.CreateCollectionRequest request
    ) {
        ResolvedPlacementTattoo resolved = resolveArchiveDesign(userSeq, request.imageSeq());
        // 취향 점수는 보관함 담기에서 이미 반영한다. 배치는 재참조만 한다.
        CollectionWriteService.CreatedCollection created = collectionWriteService.create(
                userSeq,
                request,
                resolved.tattoo(),
                resolved.displayImageSeq(),
                resolved.displayObjectKey(),
                false
        );
        return response(
                created.collection(),
                created.displayImageSeq(),
                created.displayObjectKey()
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
        // 배치는 공유 타투를 참조하므로 컬렉션 행만 소프트 삭제한다.
        collection.softDelete();
    }

    /**
     * 프론트는 GET /archive의 designImageSeq만 POST /collections에 보낸다.
     * tattoo_designs에 있고 내 보관함에 담긴 도안만 배치할 수 있다.
     */
    private ResolvedPlacementTattoo resolveArchiveDesign(Integer userSeq, Long designImageSeq) {
        TattooDesign design = tattooDesignRepository.findByImageSeqAndDeletedFalse(designImageSeq)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.STATE_CONFLICT,
                        "컬렉션에는 도안 보관함에 담긴 도안만 배치할 수 있습니다."
                ));
        Tattoo tattoo = tattooRepository
                .findByTattooSeqAndDeletedFalse(design.getTattooSeq())
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        if (!archiveExists(userSeq, tattoo.getTattooSeq())) {
            throw new BusinessException(
                    ErrorCode.STATE_CONFLICT,
                    "컬렉션에는 도안 보관함에 담긴 도안만 배치할 수 있습니다."
            );
        }
        Image designImage = imageRepository.findByImageSeqAndDeletedFalse(designImageSeq)
                .orElseThrow(() -> BusinessException.of(ErrorCode.IMAGE_NOT_FOUND));
        return new ResolvedPlacementTattoo(
                tattoo,
                designImage.getImageSeq(),
                designImage.getObjectKey()
        );
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
                       COALESCE(design_image.image_seq, original_image.image_seq) AS image_seq,
                       COALESCE(design_image.object_key, original_image.object_key) AS image_object_key,
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
                   AND tattoo.is_deleted = FALSE
                  JOIN images original_image
                    ON original_image.image_seq = tattoo.image_seq
                   AND original_image.is_deleted = FALSE
                  LEFT JOIN tattoo_designs design
                    ON design.tattoo_seq = tattoo.tattoo_seq
                   AND design.is_deleted = FALSE
                  LEFT JOIN images design_image
                    ON design_image.image_seq = design.image_seq
                   AND design_image.is_deleted = FALSE
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
        if (!enabled) {
            jdbcTemplate.update(
                    "DELETE FROM user_archive WHERE user_seq = ? AND tattoo_seq = ?",
                    userSeq,
                    tattooSeq
            );
            return false;
        }
        // 상한 검사와 INSERT 사이에 같은 회원의 다른 요청이 끼어들면 READ COMMITTED 에서는
        // 둘 다 상한 미만을 보고 통과해 상한을 넘긴다. 회원 단위로 직렬화해서 막는다.
        lockArchive(userSeq);
        // 이미 담긴 도안의 반복 요청은 보관 수를 늘리지 않으므로 상한과 무관하게 성공한다.
        if (archiveExists(userSeq, tattooSeq)) {
            return true;
        }
        if (archiveFull(userSeq)) {
            throw new BusinessException(
                    ErrorCode.ARCHIVE_LIMIT_EXCEEDED,
                    "보관함에는 도안을 최대 %d개까지 저장할 수 있습니다."
                            .formatted(collectionProperties.archiveMaxDesigns())
            );
        }
        int inserted = jdbcTemplate.update("""
                INSERT INTO user_archive (user_seq, tattoo_seq)
                SELECT ?, td.tattoo_seq
                  FROM tattoo_designs td
                  JOIN tattoos t ON t.tattoo_seq = td.tattoo_seq
                 WHERE td.tattoo_seq = ? AND td.is_deleted = FALSE
                   AND t.is_deleted = FALSE
                ON CONFLICT DO NOTHING
                """, userSeq, tattooSeq);
        if (inserted == 0) {
            throw new BusinessException(
                    ErrorCode.STATE_CONFLICT,
                    "보관함에는 tattoo_designs에 등록된 타투만 저장할 수 있습니다."
            );
        }
        preferenceScoreService.applyCollection(userSeq, tattooSeq, true);
        return true;
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

    private void lockArchive(Integer userSeq) {
        jdbcTemplate.query(
                "SELECT pg_advisory_xact_lock(?, ?)",
                resultSet -> null,
                ARCHIVE_LOCK_NAMESPACE,
                userSeq
        );
    }

    private boolean archiveFull(Integer userSeq) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) >= ? FROM user_archive WHERE user_seq = ?
                """, Boolean.class, collectionProperties.archiveMaxDesigns(), userSeq));
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

    private record ResolvedPlacementTattoo(
            Tattoo tattoo,
            Long displayImageSeq,
            String displayObjectKey
    ) {
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
