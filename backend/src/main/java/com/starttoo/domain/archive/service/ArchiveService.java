package com.starttoo.domain.archive.service;

import com.starttoo.common.api.CursorPageResponse;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.common.pagination.CursorValues;
import com.starttoo.domain.archive.dto.ArchiveDtos.*;
import com.starttoo.domain.archive.entity.UserArchiveEntity;
import com.starttoo.domain.archive.entity.UserArchiveId;
import com.starttoo.domain.archive.repository.UserArchiveRepository;
import com.starttoo.domain.image.service.ImageReferenceService;
import com.starttoo.domain.tattoo.repository.TattooDesignRepository;
import com.starttoo.domain.tattoo.repository.TattooRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class ArchiveService {
    private final UserArchiveRepository archiveRepository;
    private final TattooRepository tattooRepository;
    private final TattooDesignRepository designRepository;
    private final ImageReferenceService imageReferenceService;
    private final CursorCodec cursorCodec;
    private final Clock clock = Clock.systemUTC();

    @Transactional(readOnly=true)
    public CursorPageResponse<ArchiveItem> list(Long userId, String cursor, int size) {
        long pageNumber = CursorValues.longValue(cursorCodec.decode(cursor), "page", 0);
        var slice = archiveRepository.findAllByIdUserIdOrderBySavedAtDesc(userId, PageRequest.of((int)pageNumber, size));
        boolean hasNext = slice.hasNext();
        var page = slice.getContent();
        var items = page.stream().map(row -> {
            var tattoo = tattooRepository.findById(row.getId().getTattooId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_NOT_FOUND));
            var design = designRepository.findById(tattoo.getTattooId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_DESIGN_REQUIRED));
            return new ArchiveItem(tattoo.getTattooId(), imageReferenceService.url(tattoo.getImageId()),
                    imageReferenceService.url(design.getImageId()), tattoo.getPrimaryStyle(), tattoo.getSecondaryStyle(),
                    tattoo.getRendering(),
                    toInstant(row.getSavedAt()));
        }).toList();
        return new CursorPageResponse<>(items,
                hasNext ? cursorCodec.encode(Map.of("page", pageNumber + 1)) : null, hasNext);
    }

    @Transactional
    public ArchiveToggleResponse toggle(Long userId, Long tattooId, boolean saved) {
        if (!tattooRepository.existsById(tattooId)) throw new BusinessException(ErrorCode.TATTOO_NOT_FOUND);
        UserArchiveId id = new UserArchiveId(userId, tattooId);
        if (!saved) {
            if (archiveRepository.existsById(id)) archiveRepository.deleteById(id);
            return new ArchiveToggleResponse(tattooId, false, null);
        }
        if (!designRepository.existsById(tattooId)) throw new BusinessException(ErrorCode.TATTOO_DESIGN_REQUIRED);
        var row = archiveRepository.findById(id).orElseGet(() ->
                archiveRepository.save(UserArchiveEntity.builder().id(id).build()));
        return new ArchiveToggleResponse(tattooId, true,
                row.getSavedAt() == null ? Instant.now(clock) : toInstant(row.getSavedAt()));
    }
}
