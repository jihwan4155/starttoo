package com.starttoo.domain.tattoo.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.domain.image.service.ImageReferenceService;
import com.starttoo.domain.social.repository.UserBlockRepository;
import com.starttoo.domain.tattoo.dto.TattooDtos.*;
import com.starttoo.domain.tattoo.entity.TattooEntity;
import com.starttoo.domain.tattoo.repository.TattooDesignRepository;
import com.starttoo.domain.tattoo.repository.TattooRepository;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.starttoo.common.time.TimeMapper.toInstant;

@Service
@RequiredArgsConstructor
public class TattooService {
    private final TattooRepository tattooRepository;
    private final TattooDesignRepository designRepository;
    private final UserRepository userRepository;
    private final UserBlockRepository blockRepository;
    private final ImageReferenceService imageReferenceService;

    @Transactional(readOnly=true)
    public TattooDetail detail(Long viewerId, Long tattooId) {
        var tattoo = requireVisible(viewerId, tattooId);
        var design = designRepository.findById(tattooId).orElse(null);
        Owner owner = tattoo.getUserId() == null ? null : userRepository.findById(tattoo.getUserId())
                .map(user -> new Owner(user.getUserId(), user.getNickname())).orElse(null);
        return new TattooDetail(tattooId, owner, tattoo.getSourceType(),
                new Image(tattoo.getImageId(), imageReferenceService.url(tattoo.getImageId())),
                tattoo.getPrimaryStyle(), tattoo.getSecondaryStyle(), tattoo.getColor(), tattoo.getRendering(), design != null,
                design == null ? null : imageReferenceService.url(design.getImageId()),
                toInstant(tattoo.getCreatedAt()), toInstant(tattoo.getUpdatedAt()));
    }

    @Transactional(readOnly=true)
    public TattooImageResponse image(Long viewerId, Long tattooId) {
        var tattoo = requireVisible(viewerId, tattooId);
        return new TattooImageResponse(tattooId, tattoo.getImageId(), imageReferenceService.url(tattoo.getImageId()));
    }

    @Transactional(readOnly=true)
    public TattooDesignResponse design(Long viewerId, Long tattooId) {
        requireVisible(viewerId, tattooId);
        var design = designRepository.findById(tattooId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_DESIGN_NOT_FOUND));
        return new TattooDesignResponse(tattooId, design.getImageId(), imageReferenceService.url(design.getImageId()),
                toInstant(design.getCreatedAt()), toInstant(design.getUpdatedAt()));
    }

    @Transactional(readOnly=true)
    public void validateGenerationAccess(Long viewerId, Long tattooId) {
        requireVisible(viewerId, tattooId);
    }

    private TattooEntity requireVisible(Long viewerId, Long tattooId) {
        var tattoo = tattooRepository.findById(tattooId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TATTOO_NOT_FOUND));
        if (viewerId != null && tattoo.getUserId() != null && !viewerId.equals(tattoo.getUserId())
                && blockRepository.existsEitherDirection(viewerId, tattoo.getUserId())) {
            throw new BusinessException(ErrorCode.TATTOO_NOT_FOUND);
        }
        return tattoo;
    }
}
