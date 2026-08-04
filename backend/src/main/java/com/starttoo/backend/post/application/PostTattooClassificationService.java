package com.starttoo.backend.post.application;

import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PostTattooClassificationService {

    private final MediaService mediaService;
    private final TattooModelClient tattooModelClient;
    private final TattooService tattooService;

    @Async("postAiTaskExecutor")
    public void classifyAndPersist(
            Integer userSeq,
            List<TattooService.PreparedPostImage> preparedImages
    ) {
        try {
            List<String> imageUrls = preparedImages.stream()
                    .map(TattooService.PreparedPostImage::objectKey)
                    .map(mediaService::downloadUrl)
                    .toList();
            List<TattooModelClient.AnalysisResult> results =
                    tattooModelClient.analyzeBatch(imageUrls);
            tattooService.persistPostImageAnalyses(userSeq, preparedImages, results);
        } catch (RuntimeException exception) {
            log.warn("Post tattoo classification failed: userSeq={}, imageSeqs={}",
                    userSeq,
                    preparedImages.stream()
                            .map(TattooService.PreparedPostImage::imageSeq)
                            .toList(),
                    exception);
        }
    }
}
