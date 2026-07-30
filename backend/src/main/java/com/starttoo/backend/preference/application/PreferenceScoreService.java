package com.starttoo.backend.preference.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.preference.api.PreferenceDtos;
import com.starttoo.backend.preference.config.PreferenceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PreferenceScoreService {

    private final JdbcTemplate jdbcTemplate;
    private final PreferenceProperties properties;

    @Transactional
    public void applyPostLike(Integer userSeq, Long postSeq, boolean enabled) {
        applyPost(userSeq, postSeq, enabled ? properties.postLike() : -properties.postLike());
    }

    @Transactional
    public void applyPostBookmark(Integer userSeq, Long postSeq, boolean enabled) {
        applyPost(userSeq, postSeq, enabled ? properties.postBookmark() : -properties.postBookmark());
    }

    @Transactional
    public void applySearchClick(Integer userSeq, Long postSeq) {
        applyPost(userSeq, postSeq, properties.searchClick());
    }

    @Transactional
    public void applyNotInterested(Integer userSeq, Long postSeq, boolean enabled) {
        applyPost(
                userSeq,
                postSeq,
                enabled ? properties.notInterested() : -properties.notInterested()
        );
    }

    @Transactional
    public void applyDwell(Integer userSeq, Long postSeq, int seconds) {
        double delta = seconds >= 30
                ? properties.dwellLong()
                : seconds >= 10 ? properties.dwellMedium()
                : seconds >= 3 ? properties.dwellShort() : 0;
        if (delta != 0) {
            applyPost(userSeq, postSeq, delta);
        }
    }

    @Transactional
    public void applyCollection(Integer userSeq, Long tattooSeq, boolean enabled) {
        List<TattooClassification> values = jdbcTemplate.query("""
                SELECT primary_style_seq, color_seq
                  FROM tattoos
                 WHERE tattoo_seq = ? AND is_deleted = FALSE
                """, (rs, rowNum) -> new TattooClassification(
                rs.getInt("primary_style_seq"),
                rs.getObject("color_seq", Integer.class)
        ), tattooSeq);
        values.forEach(value -> add(
                userSeq,
                value.primaryStyleSeq(),
                value.colorSeq(),
                enabled ? properties.collection() : -properties.collection()
        ));
    }

    @Transactional
    public PreferenceDtos.Preferences survey(
            Integer userSeq,
            PreferenceDtos.SurveyRequest request
    ) {
        jdbcTemplate.queryForObject(
                "SELECT user_seq FROM users WHERE user_seq = ? FOR UPDATE",
                Integer.class,
                userSeq
        );
        Long existing = jdbcTemplate.queryForObject("""
                SELECT (
                    (SELECT COUNT(*) FROM user_primary_style_preferences WHERE user_seq = ?)
                    +
                    (SELECT COUNT(*) FROM user_color_preferences WHERE user_seq = ?)
                )
                """, Long.class, userSeq, userSeq);
        if (existing != null && existing > 0) {
            throw new BusinessException(ErrorCode.STATE_CONFLICT, "취향 설문은 최초 한 번만 반영할 수 있습니다.");
        }
        new LinkedHashSet<>(request.primaryStyleSeqs()).forEach(style ->
                add(userSeq, style, null, properties.survey()));
        if (request.colorSeqs() != null) {
            new LinkedHashSet<>(request.colorSeqs()).forEach(color ->
                    add(userSeq, null, color, properties.survey()));
        }
        return get(userSeq);
    }

    @Transactional(readOnly = true)
    public PreferenceDtos.Preferences get(Integer userSeq) {
        List<PreferenceDtos.Score> primary = jdbcTemplate.query("""
                SELECT primary_style_seq, score
                  FROM user_primary_style_preferences
                 WHERE user_seq = ?
                 ORDER BY score DESC, primary_style_seq
                """, (rs, rowNum) -> new PreferenceDtos.Score(
                rs.getInt("primary_style_seq"),
                rs.getBigDecimal("score")
        ), userSeq);
        List<PreferenceDtos.Score> colors = jdbcTemplate.query("""
                SELECT color_seq, score
                  FROM user_color_preferences
                 WHERE user_seq = ?
                 ORDER BY score DESC, color_seq
                """, (rs, rowNum) -> new PreferenceDtos.Score(
                rs.getInt("color_seq"),
                rs.getBigDecimal("score")
        ), userSeq);
        return new PreferenceDtos.Preferences(primary, colors);
    }

    private void applyPost(Integer userSeq, Long postSeq, double delta) {
        List<TattooClassification> values = jdbcTemplate.query("""
                SELECT DISTINCT t.primary_style_seq, t.color_seq
                  FROM post_images pi
                  JOIN tattoos t ON t.image_seq = pi.image_seq
                 WHERE pi.post_seq = ? AND t.is_deleted = FALSE
                """, (rs, rowNum) -> new TattooClassification(
                rs.getInt("primary_style_seq"),
                rs.getObject("color_seq", Integer.class)
        ), postSeq);
        values.forEach(value -> add(userSeq, value.primaryStyleSeq(), value.colorSeq(), delta));
    }

    private void add(Integer userSeq, Integer primaryStyleSeq, Integer colorSeq, double delta) {
        BigDecimal score = BigDecimal.valueOf(delta);
        if (primaryStyleSeq != null) {
            jdbcTemplate.update("""
                    INSERT INTO user_primary_style_preferences (
                        user_seq, primary_style_seq, score
                    ) VALUES (?, ?, ?)
                    ON CONFLICT (user_seq, primary_style_seq)
                    DO UPDATE SET
                        score = user_primary_style_preferences.score + EXCLUDED.score,
                        mod_dttm = CURRENT_TIMESTAMP
                    """, userSeq, primaryStyleSeq, score);
        }
        if (colorSeq != null) {
            jdbcTemplate.update("""
                    INSERT INTO user_color_preferences (user_seq, color_seq, score)
                    VALUES (?, ?, ?)
                    ON CONFLICT (user_seq, color_seq)
                    DO UPDATE SET
                        score = user_color_preferences.score + EXCLUDED.score,
                        mod_dttm = CURRENT_TIMESTAMP
                    """, userSeq, colorSeq, score);
        }
    }

    private record TattooClassification(Integer primaryStyleSeq, Integer colorSeq) {
    }
}
