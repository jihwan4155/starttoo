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
import com.starttoo.backend.tattoo.domain.TattooDesignRepository;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
        when(tattooModelClient.analyze("https://minio.example/presigned-original"))
                .thenReturn(analysis);

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
        when(tattooModelClient.analyze("https://minio.example/presigned-original"))
                .thenThrow(BusinessException.of(ErrorCode.NOT_TATTOO_IMAGE));

        assertThatThrownBy(() -> tattooService.prepare(7, 301L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.NOT_TATTOO_IMAGE));

        verify(tattooRepository, never()).save(any());
    }

    @Test
    void detailReturnsMultipleSubjectsAndEmptyOptionalStyleArrays() {
        Tattoo tattoo = tattoo(501L, 301L);
        when(tattooRepository.findByTattooSeqAndDeletedFalse(501L))
                .thenReturn(Optional.of(tattoo));
        when(jdbcTemplate.query(
                anyString(),
                org.mockito.ArgumentMatchers
                        .<RowMapper<TattooDtos.SubjectResponse>>any(),
                eq(501L)
        )).thenReturn(List.of(
                new TattooDtos.SubjectResponse(10, "장미"),
                new TattooDtos.SubjectResponse(11, "나비")
        ));

        TattooDtos.TattooResponse response = tattooService.get(501L);

        assertThat(response.secondaryStyleSeqs()).isEmpty();
        assertThat(response.renderingStyleSeqs()).isEmpty();
        assertThat(response.subjects())
                .extracting(TattooDtos.SubjectResponse::subjectSeq)
                .containsExactly(10, 11);
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
            assertThat(item.subjects()).singleElement()
                    .extracting(TattooDtos.SubjectResponse::subjectName)
                    .isEqualTo("장미");
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
            when(resultSet.getInt("primary_style_seq")).thenReturn(1);
            when(resultSet.getObject("color_seq", Integer.class)).thenReturn(2);
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
            when(resultSet.getInt("subject_seq")).thenReturn(10);
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
