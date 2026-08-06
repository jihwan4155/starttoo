package com.starttoo.backend.tattoo;

import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.tattoo.api.TattooDtos;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooDesign;
import com.starttoo.backend.tattoo.domain.TattooDesignRepository;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TattooServiceTest {

    @Mock
    private TattooRepository tattooRepository;

    @Mock
    private TattooDesignRepository tattooDesignRepository;

    @Mock
    private ImageRepository imageRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private MediaService mediaService;

    @Mock
    private TattooModelClient tattooModelClient;

    @Mock
    private SearchIndexEventPublisher searchIndexEventPublisher;

    @InjectMocks
    private TattooService tattooService;

    @Test
    void prepareSignsObjectKeyAndAnalyzesPresignedUrl() {
        TattooModelClient.Analysis analysis = new TattooModelClient.Analysis(
                "OTHER",
                List.of(),
                List.of("LINE"),
                "BLACK",
                List.of("타투")
        );
        when(imageRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.of(image(301L, "users/7/original.webp")));
        when(mediaService.downloadUrl("users/7/original.webp"))
                .thenReturn("https://minio.example/presigned-original");
        when(tattooModelClient.analyzeIfTattoo("https://minio.example/presigned-original"))
                .thenReturn(Optional.of(analysis));

        TattooService.PreparedTattoo prepared = tattooService.prepare(7, 301L);

        assertThat(prepared.imageSeq()).isEqualTo(301L);
        assertThat(prepared.objectKey()).isEqualTo("users/7/original.webp");
        assertThat(prepared.analysis()).isSameAs(analysis);
    }

    @Test
    void preparePropagatesNonTattooResultWithoutDatabaseWrite() {
        when(imageRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.of(image(301L, "users/7/original.webp")));
        when(mediaService.downloadUrl("users/7/original.webp"))
                .thenReturn("https://minio.example/presigned-original");
        when(tattooModelClient.analyzeIfTattoo("https://minio.example/presigned-original"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> tattooService.prepare(7, 301L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.NOT_TATTOO_IMAGE));

        verify(tattooRepository, never()).save(any());
    }

    @Test
    void postAnalysisLinksStoredDesignImageToExistingTattoo() {
        TattooModelClient.Analysis analysis = new TattooModelClient.Analysis(
                "OTHER", List.of(), List.of("LINE"), "BLACK", List.of("타투")
        );
        Tattoo tattoo = tattoo(501L, 301L);
        Image designImage = image(302L, "users/7/extraction/design.png");
        when(tattooRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.of(tattoo));
        when(imageRepository.findByObjectKeyAndDeletedFalse(
                "users/7/extraction/design.png"))
                .thenReturn(Optional.of(designImage));
        when(tattooDesignRepository.findById(501L)).thenReturn(Optional.empty());

        tattooService.persistPostImageAnalysis(
                7,
                new TattooService.PreparedPostImage(301L, "users/7/post/original.png"),
                analysis,
                "users/7/extraction/design.png"
        );

        ArgumentCaptor<TattooDesign> captor = ArgumentCaptor.forClass(TattooDesign.class);
        verify(tattooDesignRepository).save(captor.capture());
        assertThat(captor.getValue().getTattooSeq()).isEqualTo(501L);
        assertThat(captor.getValue().getImageSeq()).isEqualTo(302L);
        assertThat(captor.getValue().isIndexed()).isFalse();
    }

    @Test
    void detailReturnsClassificationLabelsAndSubjectNames() throws Exception {
        Tattoo tattoo = tattoo(501L, 301L);
        when(tattooRepository.findByTattooSeqAndDeletedFalse(501L))
                .thenReturn(Optional.of(tattoo));
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(501L)))
                .thenReturn(List.of("장미", "나비"));
        doAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getString("primary_code")).thenReturn("OTHER");
            when(resultSet.getString("primary_name")).thenReturn("기타");
            return mapper.mapRow(resultSet, 0);
        }).when(jdbcTemplate).queryForObject(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                eq(501L)
        );

        TattooDtos.TattooResponse response = tattooService.get(501L);

        assertThat(response.primaryStyle().code()).isEqualTo("OTHER");
        assertThat(response.primaryStyle().name()).isEqualTo("기타");
        assertThat(response.secondaryStyles()).isEmpty();
        assertThat(response.renderingStyles()).isEmpty();
        assertThat(response.subjects()).containsExactly("장미", "나비");
    }

    @Test
    void deletedTattooIsNotFound() {
        when(tattooRepository.findByTattooSeqAndDeletedFalse(501L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> tattooService.get(501L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.TATTOO_NOT_FOUND));
    }

    @Test
    void designVariantWithoutActiveDesignIsNotFound() {
        when(tattooRepository.findByTattooSeqAndDeletedFalse(501L))
                .thenReturn(Optional.of(tattoo(501L, 301L)));
        when(tattooDesignRepository.findByTattooSeqAndDeletedFalse(501L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> tattooService.image(
                501L,
                TattooDtos.TattooImageVariant.DESIGN
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.IMAGE_NOT_FOUND));

        verify(mediaService, never()).presignedDownload(anyString());
    }

    @Test
    void originalImageReturnsPresignedUrlAndExpiration() {
        OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(10);
        when(tattooRepository.findByTattooSeqAndDeletedFalse(501L))
                .thenReturn(Optional.of(tattoo(501L, 301L)));
        when(imageRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.of(image(301L, "users/7/original.webp")));
        when(mediaService.presignedDownload("users/7/original.webp"))
                .thenReturn(new MediaService.PresignedDownload(
                        "https://minio.example/original",
                        expiresAt
                ));

        TattooDtos.TattooImageResponse response = tattooService.image(
                501L,
                TattooDtos.TattooImageVariant.ORIGINAL
        );

        assertThat(response.imageSeq()).isEqualTo(301L);
        assertThat(response.downloadUrl()).isEqualTo("https://minio.example/original");
        assertThat(response.expiresAt()).isEqualTo(expiresAt);
    }

    @Test
    void designListBatchLoadsSubjectsAndCalculatesArchiveForOptionalViewer()
            throws Exception {
        mockDesignRows();
        mockDesignSubjects();
        when(mediaService.downloadUrl("users/7/design.webp"))
                .thenReturn("https://minio.example/design");

        CursorPageResponse<TattooDtos.TattooDesignResponse> loggedIn =
                tattooService.designs(7, null, 20);
        CursorPageResponse<TattooDtos.TattooDesignResponse> anonymous =
                tattooService.designs(null, null, 20);

        assertThat(loggedIn.items()).singleElement().satisfies(item -> {
            assertThat(item.designImageUrl()).isEqualTo("https://minio.example/design");
            assertThat(item.archivedByMe()).isTrue();
            assertThat(item.primaryStyle().code()).isEqualTo("OTHER");
            assertThat(item.color().name()).isEqualTo("검정");
            assertThat(item.subjects()).containsExactly("장미");
        });
        assertThat(anonymous.items()).singleElement()
                .extracting(TattooDtos.TattooDesignResponse::archivedByMe)
                .isEqualTo(false);
        verify(namedParameterJdbcTemplate, times(2)).query(
                anyString(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        );
        verify(namedParameterJdbcTemplate, times(2)).query(
                anyString(),
                any(SqlParameterSource.class),
                any(RowCallbackHandler.class)
        );
    }

    private void mockDesignRows() throws Exception {
        doAnswer(invocation -> {
            SqlParameterSource parameters = invocation.getArgument(1);
            RowMapper<?> mapper = invocation.getArgument(2);
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getLong("tattoo_seq")).thenReturn(501L);
            when(resultSet.getLong("design_image_seq")).thenReturn(302L);
            when(resultSet.getString("design_object_key"))
                    .thenReturn("users/7/design.webp");
            when(resultSet.getString("primary_style_code")).thenReturn("OTHER");
            when(resultSet.getString("primary_style_name")).thenReturn("기타");
            when(resultSet.getString("color_code")).thenReturn("BLACK");
            when(resultSet.getString("color_name")).thenReturn("검정");
            when(resultSet.getBoolean("archived_by_me"))
                    .thenReturn(parameters.getValue("userSeq") != null);
            when(resultSet.getObject("reg_dttm", OffsetDateTime.class))
                    .thenReturn(OffsetDateTime.parse("2026-07-30T01:30:00Z"));
            return List.of(mapper.mapRow(resultSet, 0));
        }).when(namedParameterJdbcTemplate).query(
                anyString(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        );
    }

    private void mockDesignSubjects() throws Exception {
        doAnswer(invocation -> {
            RowCallbackHandler handler = invocation.getArgument(2);
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.getLong("tattoo_seq")).thenReturn(501L);
            when(resultSet.getString("subject_name")).thenReturn("장미");
            handler.processRow(resultSet);
            return null;
        }).when(namedParameterJdbcTemplate).query(
                anyString(),
                any(SqlParameterSource.class),
                any(RowCallbackHandler.class)
        );
    }

    private Tattoo tattoo(Long tattooSeq, Long imageSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return Tattoo.builder()
                .tattooSeq(tattooSeq)
                .registrantSeq(7)
                .imageSeq(imageSeq)
                .sourceType(TattooSourceType.USER_POST)
                .primaryStyleSeq(1)
                .usedForTraining(false)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
    }

    private Image image(Long imageSeq, String objectKey) {
        OffsetDateTime now = OffsetDateTime.now();
        return Image.builder()
                .imageSeq(imageSeq)
                .objectKey(objectKey)
                .regDttm(now)
                .regUsrSeq(7)
                .modDttm(now)
                .modUsrSeq(7)
                .deleted(false)
                .build();
    }
}
