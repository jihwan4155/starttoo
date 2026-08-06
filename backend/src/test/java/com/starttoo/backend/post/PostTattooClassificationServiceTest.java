package com.starttoo.backend.post;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.post.application.PostImageClassificationWriter;
import com.starttoo.backend.post.application.PostTattooClassificationService;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PostTattooClassificationServiceTest {

    @Mock
    private MediaService mediaService;
    @Mock
    private TattooModelClient tattooModelClient;
    @Mock
    private PostImageClassificationWriter writer;

    @InjectMocks
    private PostTattooClassificationService service;

    private static final TattooModelClient.Analysis ANALYSIS = new TattooModelClient.Analysis(
            "minimal", List.of(), List.of("fine_line"), "black_only", List.of("장미")
    );

    @Test
    void appliesEachResultToItsOwnImage() {
        stubUrls();
        when(tattooModelClient.analyzeBatchItems(any())).thenReturn(List.of(
                result(62L, TattooModelClient.AnalysisStatus.NOT_TATTOO, null),
                result(61L, TattooModelClient.AnalysisStatus.TATTOO, ANALYSIS)
        ));

        service.classify(7, images());

        verify(writer).applyTattoo(
                eq(7), eq(images().get(0)), eq(ANALYSIS), eq("design-61"));
        verify(writer).markNotTattoo(62L);
        verifyNoMoreInteractions(writer);
    }

    /**
     * 한 장의 저장 실패가 이미 성공한 다른 장을 되돌리면 안 된다. 실패한 장만 재시도 대상이 된다.
     */
    @Test
    void oneImageFailureDoesNotAffectTheOtherImage() {
        stubUrls();
        when(tattooModelClient.analyzeBatchItems(any())).thenReturn(List.of(
                result(61L, TattooModelClient.AnalysisStatus.TATTOO, ANALYSIS),
                result(62L, TattooModelClient.AnalysisStatus.TATTOO, ANALYSIS)
        ));
        doThrow(new BusinessException(ErrorCode.STATE_CONFLICT, "코드 없음"))
                .when(writer).applyTattoo(
                        eq(7), eq(images().get(0)), any(), eq("design-61"));

        service.classify(7, images());

        verify(writer).markFailed(61L);
        verify(writer).applyTattoo(
                eq(7), eq(images().get(1)), eq(ANALYSIS), eq("design-62"));
        verify(writer, never()).markFailed(62L);
    }

    /**
     * 모델이 FAILED 로 내려준 이미지는 종료 상태로 굳히지 않고 재시도 대상으로 남긴다.
     */
    @Test
    void failedResultIsMarkedFailedNotNonTattoo() {
        stubUrls();
        when(tattooModelClient.analyzeBatchItems(any())).thenReturn(List.of(
                result(61L, TattooModelClient.AnalysisStatus.FAILED, null),
                result(62L, TattooModelClient.AnalysisStatus.NOT_TATTOO, null)
        ));

        service.classify(7, images());

        verify(writer).markFailed(61L);
        verify(writer).markNotTattoo(62L);
        verify(writer, never()).markNotTattoo(61L);
    }

    /**
     * AI 서버 장애·타임아웃은 게시물에 영향을 주지 않고, 전량이 재시도 대상으로 남아야 한다.
     */
    @Test
    void batchFailureMarksEveryImageForRetry() {
        stubUrls();
        when(tattooModelClient.analyzeBatchItems(any()))
                .thenThrow(BusinessException.of(ErrorCode.PROCESSING_TIMEOUT));

        service.classify(7, images());

        verify(writer).markFailed(61L);
        verify(writer).markFailed(62L);
        verify(writer, never()).markNotTattoo(any());
    }

    /**
     * 응답 길이가 어긋나면 결과를 엉뚱한 이미지에 붙이지 않고 전량 재시도로 돌린다.
     */
    @Test
    void sizeMismatchMarksEveryImageForRetryWithoutApplyingResults() {
        stubUrls();
        when(tattooModelClient.analyzeBatchItems(any())).thenReturn(List.of(
                result(61L, TattooModelClient.AnalysisStatus.TATTOO, ANALYSIS)
        ));

        service.classify(7, images());

        verify(writer).markFailed(61L);
        verify(writer).markFailed(62L);
        verify(writer, never()).applyTattoo(any(), any(), any(), any());
    }

    private void stubUrls() {
        when(mediaService.downloadUrl("object-61")).thenReturn("https://minio.test/61");
        when(mediaService.downloadUrl("object-62")).thenReturn("https://minio.test/62");
        when(mediaService.presignTattooDesignUpload(7, 61L))
                .thenReturn(new MediaService.PresignedUpload(
                        "design-61", "https://minio.test/design-61"));
        when(mediaService.presignTattooDesignUpload(7, 62L))
                .thenReturn(new MediaService.PresignedUpload(
                        "design-62", "https://minio.test/design-62"));
    }

    private TattooModelClient.AnalysisResult result(
            Long imageSeq,
            TattooModelClient.AnalysisStatus status,
            TattooModelClient.Analysis analysis
    ) {
        TattooModelClient.Design design = status == TattooModelClient.AnalysisStatus.TATTOO
                ? new TattooModelClient.Design("design-" + imageSeq)
                : null;
        return new TattooModelClient.AnalysisResult(imageSeq, status, analysis, design);
    }

    private List<TattooService.PreparedPostImage> images() {
        return List.of(
                new TattooService.PreparedPostImage(61L, "object-61"),
                new TattooService.PreparedPostImage(62L, "object-62")
        );
    }
}
