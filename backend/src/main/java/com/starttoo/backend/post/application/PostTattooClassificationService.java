package com.starttoo.backend.post.application;

import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 게시물 이미지의 타투 분류를 실행한다. 게시 응답 직후의 비동기 워커와 백필 스케줄러가
 * 같은 진입점을 공유하므로, 재시도 경로와 최초 경로의 동작이 갈라지지 않는다.
 *
 * <p>이 작업은 정보를 덧붙이기만 한다. 실패하거나 타투가 아니어도 게시물과 이미지는
 * 그대로 남고 피드에 계속 노출된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PostTattooClassificationService {

    private final MediaService mediaService;
    private final TattooModelClient tattooModelClient;
    private final PostImageClassificationWriter writer;

    /** 게시 응답 이후의 빠른 경로. 실패는 상태로 남고 백필이 최종적으로 처리한다. */
    @Async("postAiTaskExecutor")
    public void classifyAsync(
            Integer userSeq,
            List<TattooService.PreparedPostImage> preparedImages
    ) {
        classify(userSeq, preparedImages);
    }

    public void classify(
            Integer userSeq,
            List<TattooService.PreparedPostImage> preparedImages
    ) {
        if (preparedImages.isEmpty()) {
            return;
        }
        List<TattooModelClient.AnalysisResult> results;
        try {
            List<TattooModelClient.BatchImage> requests = preparedImages.stream()
                    .map(image -> {
                        MediaService.PresignedUpload upload =
                                mediaService.presignTattooDesignUpload(
                                        userSeq, image.imageSeq());
                        return new TattooModelClient.BatchImage(
                                image.imageSeq(),
                                mediaService.downloadUrl(image.objectKey()),
                                upload.objectKey(),
                                upload.url()
                        );
                    })
                    .toList();
            results = tattooModelClient.analyzeBatchItems(requests);
        } catch (RuntimeException exception) {
            // 배치 단위 실패(타임아웃, AI 서버 장애)다. 전량을 재시도 대상으로 남긴다.
            log.warn("Post tattoo classification call failed: userSeq={}, imageSeqs={}",
                    userSeq, imageSeqs(preparedImages), exception);
            preparedImages.forEach(image -> markFailedQuietly(image.imageSeq()));
            return;
        }
        if (results.size() != preparedImages.size()) {
            log.warn("Post tattoo classification size mismatch: expected={}, actual={}",
                    preparedImages.size(), results.size());
            preparedImages.forEach(image -> markFailedQuietly(image.imageSeq()));
            return;
        }
        Map<Long, TattooModelClient.AnalysisResult> resultsByImageSeq = new HashMap<>();
        for (TattooModelClient.AnalysisResult result : results) {
            if (result.imageSeq() == null
                    || resultsByImageSeq.put(result.imageSeq(), result) != null) {
                preparedImages.forEach(image -> markFailedQuietly(image.imageSeq()));
                return;
            }
        }
        for (TattooService.PreparedPostImage image : preparedImages) {
            TattooModelClient.AnalysisResult result = resultsByImageSeq.get(image.imageSeq());
            if (result == null) {
                markFailedQuietly(image.imageSeq());
                continue;
            }
            apply(userSeq, image, result);
        }
    }

    /**
     * 이미지 한 장을 반영한다. 이미지별로 별도 트랜잭션이므로 한 장이 실패해도
     * 나머지 장의 결과는 그대로 유지된다.
     */
    private void apply(
            Integer userSeq,
            TattooService.PreparedPostImage image,
            TattooModelClient.AnalysisResult result
    ) {
        try {
            if (result.failed()) {
                writer.markFailed(image.imageSeq());
                return;
            }
            if (result.tattoo()) {
                if (result.design() == null) {
                    writer.markFailed(image.imageSeq());
                    return;
                }
                mediaService.verifyTattooDesignUpload(
                        userSeq,
                        image.imageSeq(),
                        result.design().objectKey()
                );
                writer.applyTattoo(
                        userSeq,
                        image,
                        result.analysis(),
                        result.design().objectKey()
                );
                return;
            }
            writer.markNotTattoo(image.imageSeq());
        } catch (RuntimeException exception) {
            // 저장 실패(예: 모델 코드가 활성 기준정보에 없음)다. 이 장만 재시도 대상이 된다.
            log.warn("Post tattoo classification persist failed: imageSeq={}",
                    image.imageSeq(), exception);
            markFailedQuietly(image.imageSeq());
        }
    }

    private void markFailedQuietly(Long imageSeq) {
        try {
            writer.markFailed(imageSeq);
        } catch (RuntimeException exception) {
            log.warn("Failed to mark classification failure: imageSeq={}", imageSeq, exception);
        }
    }

    private List<Long> imageSeqs(List<TattooService.PreparedPostImage> preparedImages) {
        return preparedImages.stream()
                .map(TattooService.PreparedPostImage::imageSeq)
                .toList();
    }
}
