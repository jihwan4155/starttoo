package com.starttoo.backend.post.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.domain.ClassificationStatus;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostImage;
import com.starttoo.backend.post.domain.PostImageRepository;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.tattoo.application.TattooService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PostWriteService {

    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;

    @Transactional
    public Post create(
            Integer userSeq,
            PostDtos.CreatePostRequest request,
            List<TattooService.PreparedPostImage> preparedImages
    ) {
        try {
            OffsetDateTime now = OffsetDateTime.now();
            Post post = postRepository.save(Post.builder()
                    .authorSeq(userSeq)
                    .content(request.content())
                    .postStatus(PostStatus.PUBLISHED)
                    .likeCount(0)
                    .commentCount(0)
                    .reportCount(0)
                    .regDttm(now)
                    .modDttm(now)
                    .modUsrSeq(userSeq)
                    .deleted(false)
                    .build());
            for (int index = 0; index < preparedImages.size(); index++) {
                postImageRepository.save(PostImage.builder()
                        .postSeq(post.getPostSeq())
                        .imageSeq(preparedImages.get(index).imageSeq())
                        .displayOrder((short) (index + 1))
                        // 게시물과 같은 트랜잭션에서 분류 대기 상태를 남긴다. 이 시점부터
                        // 작업이 DB 에 존재하므로 비동기 워커가 실패해도 백필이 처리한다.
                        .classificationStatus(ClassificationStatus.PENDING)
                        .classificationAttemptCount((short) 0)
                        .regDttm(now)
                        .modDttm(now)
                        .build());
            }
            return post;
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }
    }
}
