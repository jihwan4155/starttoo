package com.starttoo.backend.post.application;

import com.starttoo.backend.post.domain.ClassificationStatus;
import com.starttoo.backend.tattoo.application.TattooModelClient;
import com.starttoo.backend.tattoo.application.TattooService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 게시물 이미지의 분류 결과를 이미지 한 장 단위로 반영한다.
 *
 * <p>여기의 각 메서드가 트랜잭션 경계다. 호출자(루프)는 반드시 다른 빈에 있어야 하며,
 * 그래야 한 장의 실패가 이미 성공한 다른 장을 롤백시키지 않는다.
 *
 * <p>어떤 경로에서도 post_images 행을 삭제하지 않는다. 분류는 정보를 덧붙이는 작업이고,
 * 결과가 무엇이든 게시물과 이미지의 노출에는 영향을 주지 않는다.
 */
@Service
@RequiredArgsConstructor
public class PostImageClassificationWriter {

    private final TattooService tattooService;
    private final JdbcTemplate jdbcTemplate;

    /**
     * tattoos 저장과 상태 전이를 한 트랜잭션에서 처리한다. 둘이 갈라지면 tattoos 없이
     * DONE 으로 남아 영구히 재시도되지 않는 행이 생긴다.
     */
    @Transactional
    public void applyTattoo(
            Integer userSeq,
            TattooService.PreparedPostImage image,
            TattooModelClient.Analysis analysis,
            String designObjectKey
    ) {
        tattooService.persistPostImageAnalysis(
                userSeq, image, analysis, designObjectKey);
        updateStatus(image.imageSeq(), ClassificationStatus.DONE);
    }

    @Transactional
    public void markNotTattoo(Long imageSeq) {
        updateStatus(imageSeq, ClassificationStatus.NOT_TATTOO);
    }

    @Transactional
    public void markFailed(Long imageSeq) {
        updateStatus(imageSeq, ClassificationStatus.FAILED);
    }

    /**
     * 시도 횟수는 여기서 올리지 않는다. 재시도 예산은 백필이 행을 선점하는 시점에 한 번만
     * 차감해야 하며, 여기서도 올리면 한 번의 시도가 두 번으로 계산된다.
     */
    private void updateStatus(Long imageSeq, ClassificationStatus status) {
        jdbcTemplate.update("""
                UPDATE post_images
                   SET classification_status = ?,
                       classification_mod_dttm = CURRENT_TIMESTAMP,
                       mod_dttm = CURRENT_TIMESTAMP
                 WHERE image_seq = ?
                """, status.name(), imageSeq);
    }
}
