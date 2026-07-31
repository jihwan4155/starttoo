package com.starttoo.backend.preference;

import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.preference.config.PreferenceProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PreferenceScoreServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private final PreferenceProperties properties = new PreferenceProperties(
            1.0,
            2.0,
            3.0,
            4.0,
            5.0,
            -6.0,
            0.5,
            1.0,
            2.0
    );

    private PreferenceScoreService preferenceScoreService;

    @Test
    void postLikeAppliesEachDistinctStyleAndColorOnlyOnce() throws Exception {
        preferenceScoreService = new PreferenceScoreService(jdbcTemplate, properties);
        doAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(
                    mapper.mapRow(classificationRow(1, 10), 0),
                    mapper.mapRow(classificationRow(1, 11), 1),
                    mapper.mapRow(classificationRow(2, 10), 2)
            );
        }).when(jdbcTemplate).query(
                anyString(),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any(),
                any(Object[].class)
        );

        preferenceScoreService.applyPostLike(7, 31L, true);

        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate, times(4)).update(anyString(), args.capture());
        assertThat(args.getAllValues())
                .extracting(values -> values[1])
                .containsExactlyInAnyOrder(1, 2, 10, 11);
    }

    private ResultSet classificationRow(int primaryStyleSeq, int colorSeq) throws Exception {
        ResultSet resultSet = org.mockito.Mockito.mock(ResultSet.class);
        when(resultSet.getInt("primary_style_seq")).thenReturn(primaryStyleSeq);
        when(resultSet.getObject("color_seq", Integer.class)).thenReturn(colorSeq);
        return resultSet;
    }
}
