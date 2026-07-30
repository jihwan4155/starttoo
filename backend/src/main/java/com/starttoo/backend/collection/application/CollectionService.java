package com.starttoo.backend.collection.application;

import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CollectionService {

    private final TattooCollectionRepository collectionRepository;
    private final TattooRepository tattooRepository;
    private final TattooService tattooService;
    private final PreferenceScoreService preferenceScoreService;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final MediaService mediaService;

    @Transactional
    public CollectionDtos.CollectionResponse create(
            Integer userSeq,
            CollectionDtos.CreateCollectionRequest request
    ) {
        Tattoo tattoo = tattooService.process(
                userSeq,
                request.imageSeq(),
                TattooSourceType.USER_COLLECTION
        );
        OffsetDateTime now = OffsetDateTime.now();
        TattooCollection collection = collectionRepository.save(TattooCollection.builder()
                .userSeq(userSeq)
                .tattooSeq(tattoo.getTattooSeq())
                .bodyView(request.bodyView())
                .positionX(request.positionX())
                .positionY(request.positionY())
                .scaleRatio(request.scaleRatio())
                .rotationDegree(request.rotationDegree())
                .flipped(request.flipped())
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build());
        preferenceScoreService.applyCollection(userSeq, tattoo.getTattooSeq(), true);
        return response(collection, tattoo.getImageSeq());
    }

    @Transactional(readOnly = true)
    public List<CollectionDtos.CollectionResponse> list(Integer userSeq) {
        List<TattooCollection> collections = collectionRepository
                .findAllByUserSeqAndDeletedFalseOrderByCollectionSeqDesc(userSeq);
        Map<Long, Tattoo> tattoos = new HashMap<>();
        tattooRepository.findAllById(
                collections.stream().map(TattooCollection::getTattooSeq).toList()
        ).stream()
                .filter(value -> !value.isDeleted())
                .forEach(value -> tattoos.put(value.getTattooSeq(), value));
        return collections.stream().map(collection -> {
            Tattoo tattoo = tattoos.get(collection.getTattooSeq());
            if (tattoo == null) {
                throw BusinessException.of(ErrorCode.TATTOO_NOT_FOUND);
            }
            return response(collection, tattoo.getImageSeq());
        }).toList();
    }

    @Transactional
    public CollectionDtos.CollectionResponse update(
            Integer userSeq,
            Long collectionSeq,
            CollectionDtos.UpdatePlacementRequest request
    ) {
        TattooCollection collection = findOwned(userSeq, collectionSeq);
        collection.updatePlacement(
                request.bodyView(),
                request.positionX(),
                request.positionY(),
                request.scaleRatio(),
                request.rotationDegree(),
                request.flipped()
        );
        Tattoo tattoo = tattooRepository.findByTattooSeqAndDeletedFalse(collection.getTattooSeq())
                .orElseThrow(() -> BusinessException.of(ErrorCode.TATTOO_NOT_FOUND));
        return response(collection, tattoo.getImageSeq());
    }

    @Transactional
    public void delete(Integer userSeq, Long collectionSeq) {
        TattooCollection collection = findOwned(userSeq, collectionSeq);
        preferenceScoreService.applyCollection(userSeq, collection.getTattooSeq(), false);
        collection.softDelete();
        tattooRepository.findByTattooSeqAndDeletedFalse(collection.getTattooSeq())
                .ifPresent(Tattoo::softDelete);
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
        int deleted = jdbcTemplate.update(
                "DELETE FROM user_archive WHERE user_seq = ? AND tattoo_seq = ?",
                userSeq,
                tattooSeq
        );
        if (deleted > 0) {
            preferenceScoreService.applyCollection(userSeq, tattooSeq, false);
        }
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
                       t.primary_style_seq,
                       t.color_seq,
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
                       :cursorDttm IS NULL
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
                rs.getInt("primary_style_seq"),
                rs.getObject("color_seq", Integer.class),
                rs.getObject("archived_dttm", OffsetDateTime.class)
        ));
        boolean hasNext = rows.size() > safeSize;
        List<ArchiveRow> page = hasNext ? rows.subList(0, safeSize) : rows;
        List<CollectionDtos.TattooDesignItem> items = page.stream()
                .map(row -> new CollectionDtos.TattooDesignItem(
                        row.tattooSeq(),
                        row.designImageSeq(),
                        mediaService.downloadUrl(row.designObjectKey()),
                        row.primaryStyleSeq(),
                        row.colorSeq(),
                        subjects(row.tattooSeq()),
                        row.archivedDttm()
                ))
                .toList();
        String nextCursor = hasNext ? encodeArchiveCursor(page.get(page.size() - 1)) : null;
        return CursorPageResponse.of(items, nextCursor, hasNext);
    }

    private List<CollectionDtos.SubjectItem> subjects(Long tattooSeq) {
        return jdbcTemplate.query("""
                SELECT s.subject_seq, s.subject_name
                  FROM tattoo_subjects ts
                  JOIN subjects s ON s.subject_seq = ts.subject_seq
                 WHERE ts.tattoo_seq = ?
                 ORDER BY s.subject_seq
                """, (rs, rowNum) -> new CollectionDtos.SubjectItem(
                rs.getInt("subject_seq"),
                rs.getString("subject_name")
        ), tattooSeq);
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
            Integer primaryStyleSeq,
            Integer colorSeq,
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
            Long imageSeq
    ) {
        return new CollectionDtos.CollectionResponse(
                collection.getCollectionSeq(),
                collection.getTattooSeq(),
                imageSeq,
                collection.getBodyView(),
                collection.getPositionX(),
                collection.getPositionY(),
                collection.getScaleRatio(),
                collection.getRotationDegree(),
                collection.isFlipped(),
                collection.getRegDttm(),
                collection.getModDttm()
        );
    }
}
