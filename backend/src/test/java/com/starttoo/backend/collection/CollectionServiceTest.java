package com.starttoo.backend.collection;

import com.starttoo.backend.collection.application.CollectionService;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CollectionServiceTest {

    @Mock
    private TattooCollectionRepository collectionRepository;

    @Mock
    private TattooRepository tattooRepository;

    @Mock
    private TattooService tattooService;

    @Mock
    private PreferenceScoreService preferenceScoreService;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private MediaService mediaService;

    @InjectMocks
    private CollectionService collectionService;

    @Test
    void savingNonDesignTattooReturnsStateConflict() {
        when(jdbcTemplate.update(anyString(), eq(1), eq(501L))).thenReturn(0);
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), eq(1), eq(501L)))
                .thenReturn(false);

        assertThatThrownBy(() -> collectionService.setArchive(1, 501L, true))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATE_CONFLICT);

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    @Test
    void repeatedSaveDoesNotChangePreferenceScoreAgain() {
        when(jdbcTemplate.update(anyString(), eq(1), eq(501L))).thenReturn(0);
        when(jdbcTemplate.queryForObject(anyString(), eq(Boolean.class), eq(1), eq(501L)))
                .thenReturn(true);

        collectionService.setArchive(1, 501L, true);

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    @Test
    void repeatedDeleteDoesNotChangePreferenceScoreAgain() {
        when(jdbcTemplate.update(anyString(), eq(1), eq(501L))).thenReturn(0);

        collectionService.setArchive(1, 501L, false);

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }
}
