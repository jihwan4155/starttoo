package com.starttoo.backend.tattoo;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.tattoo.application.TattooExtractionService;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TattooExtractionServiceTest {

    private final TattooService tattooService = mock(TattooService.class);
    private final TattooModelClient tattooModelClient = mock(TattooModelClient.class);
    private final MediaService mediaService = mock(MediaService.class);
    private TattooExtractionService service;

    private final TattooService.PreparedPostImage source =
            new TattooService.PreparedPostImage(31L, "users/7/extraction/source.png");
    private final MediaService.PresignedUpload designUpload =
            new MediaService.PresignedUpload(
                    "users/7/extraction/design.png",
                    "https://minio.test/design-upload"
            );

    @BeforeEach
    void setUp() {
        service = new TattooExtractionService(tattooService, tattooModelClient, mediaService);
        when(tattooService.preparePostImage(7, 31L)).thenReturn(source);
        when(mediaService.presignTattooDesignUpload(7, 31L)).thenReturn(designUpload);
        when(mediaService.downloadUrl(source.objectKey()))
                .thenReturn("https://minio.test/source-download");
    }

    @Test
    void persistsDetectedTattooAndReturnsSaveableDesign() {
        TattooModelClient.Analysis analysis = analysis();
        TattooModelClient.BatchImage request = new TattooModelClient.BatchImage(
                31L,
                "https://minio.test/source-download",
                designUpload.objectKey(),
                designUpload.url()
        );
        when(tattooModelClient.analyzeBatchItems(List.of(request))).thenReturn(List.of(
                new TattooModelClient.AnalysisResult(
                        31L,
                        TattooModelClient.AnalysisStatus.TATTOO,
                        analysis,
                        new TattooModelClient.Design(designUpload.objectKey())
                )
        ));
        when(tattooService.persistImageAnalysis(
                7,
                source,
                analysis,
                designUpload.objectKey(),
                TattooSourceType.USER_EXTRACTION
        )).thenReturn(new TattooService.PersistedDesign(91L, 92L));
        when(mediaService.downloadUrl(designUpload.objectKey()))
                .thenReturn("https://minio.test/design-download");

        var response = service.extract(7, 31L);

        assertThat(response.tattooSeq()).isEqualTo(91L);
        assertThat(response.designImageSeq()).isEqualTo(92L);
        assertThat(response.designImageUrl()).isEqualTo("https://minio.test/design-download");
        verify(mediaService).verifyTattooDesignUpload(7, 31L, designUpload.objectKey());
    }

    @Test
    void stopsBeforePersistingWhenTattooIsNotDetected() {
        when(tattooModelClient.analyzeBatchItems(List.of(request()))).thenReturn(List.of(
                new TattooModelClient.AnalysisResult(
                        31L,
                        TattooModelClient.AnalysisStatus.NOT_TATTOO,
                        null,
                        null
                )
        ));

        assertThatThrownBy(() -> service.extract(7, 31L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.NOT_TATTOO_IMAGE));
        verify(mediaService, never()).verifyTattooDesignUpload(7, 31L, designUpload.objectKey());
        verify(tattooService, never()).persistImageAnalysis(
                7,
                source,
                null,
                designUpload.objectKey(),
                TattooSourceType.USER_EXTRACTION
        );
    }

    @Test
    void reportsModelFailureSeparatelyFromNoTattoo() {
        when(tattooModelClient.analyzeBatchItems(List.of(request()))).thenReturn(List.of(
                new TattooModelClient.AnalysisResult(
                        31L,
                        TattooModelClient.AnalysisStatus.FAILED,
                        null,
                        null
                )
        ));

        assertThatThrownBy(() -> service.extract(7, 31L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.UPSTREAM_SERVICE_ERROR));
    }

    private TattooModelClient.BatchImage request() {
        return new TattooModelClient.BatchImage(
                31L,
                "https://minio.test/source-download",
                designUpload.objectKey(),
                designUpload.url()
        );
    }

    private TattooModelClient.Analysis analysis() {
        return new TattooModelClient.Analysis(
                "minimal",
                List.of(),
                List.of("fine_line"),
                "black_only",
                List.of("장미")
        );
    }
}
