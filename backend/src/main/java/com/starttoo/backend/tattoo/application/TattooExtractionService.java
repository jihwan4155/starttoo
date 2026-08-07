package com.starttoo.backend.tattoo.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.tattoo.api.TattooDtos;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** 마이페이지에서 올린 사진 한 장을 판정하고 저장 가능한 타투 도안으로 만든다. */
@Service
@RequiredArgsConstructor
public class TattooExtractionService {

    private final TattooService tattooService;
    private final TattooModelClient tattooModelClient;
    private final MediaService mediaService;

    public TattooDtos.ExtractTattooResponse extract(Integer userSeq, Long imageSeq) {
        TattooService.PreparedPostImage image = tattooService.preparePostImage(userSeq, imageSeq);
        MediaService.PresignedUpload designUpload =
                mediaService.presignTattooDesignUpload(userSeq, image.imageSeq());

        TattooModelClient.AnalysisResult result = tattooModelClient.analyzeBatchItems(List.of(
                new TattooModelClient.BatchImage(
                        image.imageSeq(),
                        mediaService.downloadUrl(image.objectKey()),
                        designUpload.objectKey(),
                        designUpload.url()
                )
        )).getFirst();

        if (result.failed()) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }
        if (!result.tattoo()) {
            throw BusinessException.of(ErrorCode.NOT_TATTOO_IMAGE);
        }
        if (result.design() == null) {
            throw BusinessException.of(ErrorCode.UPSTREAM_SERVICE_ERROR);
        }

        String designObjectKey = result.design().objectKey();
        mediaService.verifyTattooDesignUpload(userSeq, image.imageSeq(), designObjectKey);
        TattooService.PersistedDesign persisted = tattooService.persistImageAnalysis(
                userSeq,
                image,
                result.analysis(),
                designObjectKey,
                TattooSourceType.USER_EXTRACTION
        );
        return new TattooDtos.ExtractTattooResponse(
                persisted.tattooSeq(),
                persisted.designImageSeq(),
                mediaService.downloadUrl(designObjectKey)
        );
    }
}
